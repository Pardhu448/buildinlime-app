import { useState } from "react"
import { View, Image, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native"
import { colors } from "@/src/presentation/shared/colors"
import { useAuthHeaders } from "@/src/presentation/resources/lib/media-source"
import { ImageViewerModal } from "./ImageViewerModal"

// An image rendered INSIDE a message bubble (not a download chip). Tap to open
// full-screen. `remoteUrl` is the session-guarded file route (needs auth
// headers); `localUri` is a not-yet-uploaded file on the device (no auth).

interface InlineImageProps {
  remoteUrl?: string
  localUri?: string
}

// Cap on the bubble media so a tall portrait shot doesn't take over the thread.
const MAX_W = 240
const MAX_H = 280
const DEFAULT_RATIO = 4 / 3

export function InlineImage({ remoteUrl, localUri }: InlineImageProps) {
  const headers = useAuthHeaders()
  const [ratio, setRatio] = useState(DEFAULT_RATIO)
  const [failed, setFailed] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)

  const uri = localUri ?? remoteUrl ?? null
  // Local files are already on disk; only the remote route needs the cookie.
  const needsAuth = !localUri && !!remoteUrl
  const source = uri ? (needsAuth && headers ? { uri, headers } : { uri }) : null
  const waitingForAuth = needsAuth && !headers

  // Fit within the box while preserving aspect ratio.
  const width = Math.min(MAX_W, MAX_H * ratio)
  const height = width / ratio

  if (!uri || failed) {
    return (
      <View style={[styles.frame, styles.fallback, { width: MAX_W, height: 160 }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    )
  }

  return (
    <>
      <TouchableOpacity activeOpacity={0.85} onPress={() => setViewerOpen(true)}>
        <View style={[styles.frame, { width, height: Math.min(height, MAX_H) }]}>
          {source && !waitingForAuth ? (
            <Image
              source={source}
              style={styles.image}
              resizeMode="cover"
              onLoad={(e) => {
                const { width: w, height: h } = e.nativeEvent.source
                if (w > 0 && h > 0) setRatio(w / h)
              }}
              onError={() => setFailed(true)}
            />
          ) : (
            <ActivityIndicator size="small" color={colors.primary} />
          )}
        </View>
      </TouchableOpacity>

      <ImageViewerModal
        visible={viewerOpen}
        uri={uri}
        headers={needsAuth ? (headers ?? undefined) : undefined}
        onClose={() => setViewerOpen(false)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.iconChip,
    alignItems: "center",
    justifyContent: "center",
  },
  fallback: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  image: {
    width: "100%",
    height: "100%",
  },
})
