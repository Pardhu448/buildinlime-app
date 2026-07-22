import { useEffect, useState } from "react"
import { View, Image, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native"
import * as VideoThumbnails from "expo-video-thumbnails"
import { Play } from "lucide-react-native"
import { useAuthHeaders } from "@/src/presentation/resources/lib/media-source"
import { VideoPlayerModal } from "./VideoPlayerModal"

// A video INSIDE a message bubble, rendered as a still POSTER (its first frame)
// with a play button. Tapping opens VideoPlayerModal, which is the only place a
// live expo-video player is mounted — the list itself never holds one, so it
// can't churn expo-video's shared objects or exhaust the device's decoders.
// Extracting the poster is a one-shot native call (expo-video-thumbnails), not a
// live player, so N of them in a list is safe.

interface InlineVideoProps {
  remoteUrl?: string
  localUri?: string
}

const WIDTH = 240
const HEIGHT = (WIDTH * 9) / 16

export function InlineVideo({ remoteUrl, localUri }: InlineVideoProps) {
  const headers = useAuthHeaders()
  const [poster, setPoster] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const uri = localUri ?? remoteUrl ?? null
  const needsAuth = !localUri && !!remoteUrl

  useEffect(() => {
    if (!uri) return
    // Remote frames need the session cookie; wait for it. Local files don't.
    if (needsAuth && !headers) return
    let cancelled = false
    void (async () => {
      try {
        const { uri: thumb } = await VideoThumbnails.getThumbnailAsync(uri, {
          time: 1000,
          ...(needsAuth && headers ? { headers } : {}),
        })
        if (!cancelled) setPoster(thumb)
      } catch {
        // Extraction failed (codec/network) — the play button on a dark frame is
        // still a perfectly usable affordance, so just leave the poster empty.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [uri, needsAuth, headers])

  return (
    <>
      <TouchableOpacity activeOpacity={0.85} onPress={() => setOpen(true)}>
        <View style={styles.frame}>
          {poster ? (
            <Image source={{ uri: poster }} style={styles.poster} resizeMode="cover" />
          ) : (
            <ActivityIndicator size="small" color="#fff" />
          )}
          <View style={styles.playBadge}>
            <Play size={22} color="#fff" fill="#fff" strokeWidth={0} />
          </View>
        </View>
      </TouchableOpacity>

      {open && (
        <VideoPlayerModal remoteUrl={remoteUrl} localUri={localUri} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  frame: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  poster: {
    ...StyleSheet.absoluteFillObject,
  },
  playBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    // Nudge the triangle to look centered inside the circle.
    paddingLeft: 3,
  },
})
