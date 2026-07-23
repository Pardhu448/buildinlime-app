import { useState } from "react"
import { View, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native"
import { Image, type ImageLoadEventData } from "expo-image"
import { colors } from "@/src/presentation/shared/colors"
import { useCachedResourceFile } from "@/src/presentation/resources/lib/resource-cache"
import { ImageViewerModal } from "./ImageViewerModal"

// An image rendered INSIDE a message bubble (not a download chip). Tap to open
// full-screen. `remoteUrl` is the session-guarded file route — cached to a local
// file on first view (see resource-cache), so reopening the thread is instant and
// needs no auth headers; `localUri` is a not-yet-uploaded file already on the device.

interface InlineImageProps {
  remoteUrl?: string
  localUri?: string
  mimeType?: string
}

// Cap on the bubble media so a tall portrait shot doesn't take over the thread.
const MAX_W = 240
const MAX_H = 280
const DEFAULT_RATIO = 4 / 3

export function InlineImage({ remoteUrl, localUri, mimeType }: InlineImageProps) {
  const [ratio, setRatio] = useState(DEFAULT_RATIO)
  const [failed, setFailed] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)

  // Local files are already on disk; the remote route is cached to one on first view.
  const cached = useCachedResourceFile(localUri ? undefined : remoteUrl, mimeType)
  const uri = localUri ?? cached.uri
  const loadFailed = failed || cached.failed

  // Fit within the box while preserving aspect ratio.
  const width = Math.min(MAX_W, MAX_H * ratio)
  const height = width / ratio

  if (loadFailed || (!uri && !remoteUrl && !localUri)) {
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
          {uri ? (
            <Image
              source={{ uri }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              onLoad={(e: ImageLoadEventData) => {
                const { width: w, height: h } = e.source
                if (w > 0 && h > 0) setRatio(w / h)
              }}
              onError={() => setFailed(true)}
            />
          ) : (
            <ActivityIndicator size="small" color={colors.primary} />
          )}
        </View>
      </TouchableOpacity>

      <ImageViewerModal visible={viewerOpen} uri={uri} onClose={() => setViewerOpen(false)} />
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
