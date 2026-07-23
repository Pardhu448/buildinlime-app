import { useEffect, useState } from "react"
import { View, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native"
import { Image } from "expo-image"
import * as VideoThumbnails from "expo-video-thumbnails"
import { Play } from "lucide-react-native"
import { useCachedVideoPoster } from "@/src/presentation/resources/lib/resource-cache"
import { VideoPlayerModal } from "./VideoPlayerModal"

// A video INSIDE a message bubble, rendered as a still POSTER (its first frame)
// with a play button. Tapping opens VideoPlayerModal, which is the only place a
// live expo-video player is mounted — the list itself never holds one, so it
// can't churn expo-video's shared objects or exhaust the device's decoders.
//
// The poster for a synced video is decoded ONCE from the cached file and reused on
// every reopen (see resource-cache); a still-uploading video (localUri) decodes its
// own frame directly, since it has no resource id to cache under yet.

interface InlineVideoProps {
  remoteUrl?: string
  localUri?: string
}

const WIDTH = 240
const HEIGHT = (WIDTH * 9) / 16

export function InlineVideo({ remoteUrl, localUri }: InlineVideoProps) {
  const [open, setOpen] = useState(false)

  // Synced video: cached poster, keyed by resource id. Pending upload: decode the
  // local frame directly (transient, no id to cache under).
  const remotePoster = useCachedVideoPoster(localUri ? undefined : remoteUrl)
  const [localPoster, setLocalPoster] = useState<string | null>(null)
  useEffect(() => {
    if (!localUri) return
    let cancelled = false
    void VideoThumbnails.getThumbnailAsync(localUri, { time: 1000 })
      .then(({ uri }) => {
        if (!cancelled) setLocalPoster(uri)
      })
      .catch(() => {
        // Extraction failed — the play button on a dark frame is still usable.
      })
    return () => {
      cancelled = true
    }
  }, [localUri])

  const poster = localUri ? localPoster : remotePoster.uri

  return (
    <>
      <TouchableOpacity activeOpacity={0.85} onPress={() => setOpen(true)}>
        <View style={styles.frame}>
          {poster ? (
            <Image source={{ uri: poster }} style={styles.poster} contentFit="cover" cachePolicy="memory-disk" />
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
