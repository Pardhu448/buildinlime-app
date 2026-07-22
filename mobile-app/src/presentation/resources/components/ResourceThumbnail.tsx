import { useEffect, useState } from "react"
import { View, Image, ActivityIndicator, StyleSheet } from "react-native"
import * as VideoThumbnails from "expo-video-thumbnails"
import { File, FileText, Music, Play } from "lucide-react-native"
import { colors } from "@/src/presentation/shared/colors"
import { API_URL, useAuthHeaders } from "@/src/presentation/resources/lib/media-source"

/** First frame of the video, pulled from the actual uploaded file. */
function VideoThumb({ url, size }: { url: string; size: number }) {
  const headers = useAuthHeaders()
  const [uri, setUri] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!headers) return
    let cancelled = false
    void (async () => {
      try {
        const { uri: thumb } = await VideoThumbnails.getThumbnailAsync(url, {
          time: 1000,
          headers,
        })
        if (!cancelled) setUri(thumb)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [url, headers])

  if (failed) return <IconThumb mimeType="video/" size={size} />

  return (
    <View style={[styles.thumb, { width: size, height: size }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      ) : (
        <ActivityIndicator size="small" color={colors.primary} />
      )}
      {/* Play badge marks it as video once the frame is in */}
      {uri ? (
        <View style={styles.playBadge}>
          <Play size={10} color="#fff" fill="#fff" strokeWidth={0} />
        </View>
      ) : null}
    </View>
  )
}

function ImageThumb({ url, size }: { url: string; size: number }) {
  const headers = useAuthHeaders()
  const [failed, setFailed] = useState(false)

  if (failed) return <IconThumb mimeType="image/" size={size} />

  return (
    <View style={[styles.thumb, { width: size, height: size }]}>
      {headers ? (
        <Image
          source={{ uri: url, headers }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <ActivityIndicator size="small" color={colors.primary} />
      )}
    </View>
  )
}

/** Non-previewable types (pdf, audio, docs) keep an icon. */
function IconThumb({ mimeType, size }: { mimeType: string; size: number }) {
  const Icon = mimeType.startsWith("audio/")
    ? Music
    : mimeType === "application/pdf" ||
        mimeType.includes("word") ||
        mimeType.includes("text")
      ? FileText
      : File

  return (
    <View style={[styles.thumb, styles.iconThumb, { width: size, height: size }]}>
      <Icon size={Math.round(size * 0.45)} color={colors.primary} strokeWidth={1.8} />
    </View>
  )
}

interface ResourceThumbnailProps {
  /** Resource.file_location — a server path, not a full URL. */
  fileLocation?: string | null
  /** For not-yet-uploaded files, the local device uri renders directly. */
  localUri?: string | null
  mimeType: string
  size?: number
}

export function ResourceThumbnail({
  fileLocation,
  localUri,
  mimeType,
  size = 40,
}: ResourceThumbnailProps) {
  // A pending upload still lives on the device — no auth, no network needed.
  if (localUri && mimeType.startsWith("image/")) {
    return (
      <View style={[styles.thumb, { width: size, height: size }]}>
        <Image source={{ uri: localUri }} style={styles.image} resizeMode="cover" />
      </View>
    )
  }

  if (!fileLocation) return <IconThumb mimeType={mimeType} size={size} />

  const url = `${API_URL}${fileLocation}`
  if (mimeType.startsWith("image/")) return <ImageThumb url={url} size={size} />
  if (mimeType.startsWith("video/")) return <VideoThumb url={url} size={size} />
  return <IconThumb mimeType={mimeType} size={size} />
}

const styles = StyleSheet.create({
  thumb: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.iconChip,
    alignItems: "center",
    justifyContent: "center",
  },
  iconThumb: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  playBadge: {
    position: "absolute",
    right: 3,
    bottom: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
})
