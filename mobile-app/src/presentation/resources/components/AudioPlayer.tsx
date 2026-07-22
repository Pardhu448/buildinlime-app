import { useEffect, useMemo, useRef, useState } from "react"
import { View, Text, TouchableOpacity, Pressable, StyleSheet, type GestureResponderEvent } from "react-native"
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio"
import { Play, Pause } from "lucide-react-native"
import { colors } from "@/src/presentation/shared/colors"
import { formatDuration } from "@/src/presentation/resources/lib/attachment-format"
import { useAuthHeaders } from "@/src/presentation/resources/lib/media-source"

// A voice/audio clip rendered INSIDE a message bubble: play/pause, a scrubbable
// progress bar, and elapsed/total time. `remoteUrl` is the session-guarded file
// route (needs auth headers); `localUri` is a not-yet-uploaded device file.
//
// The live expo-audio player (a native shared object, like expo-video's) is NOT
// created until the user first taps play — mounting one per list row churns and
// exhausts those shared objects exactly the way multiple inline video players
// did. Until then the row is a static play button; the player exists only for
// clips the user has actually started.

interface AudioPlayerProps {
  remoteUrl?: string
  localUri?: string
  /** Flip the palette so the control stays legible on a dark own-bubble. */
  isOwn: boolean
}

function palette(isOwn: boolean) {
  return {
    tint: isOwn ? colors.primaryForeground : colors.primary,
    trackBg: isOwn ? "rgba(255,255,255,0.28)" : colors.cardBorder,
    textColor: isOwn ? colors.primaryForeground : colors.foreground,
  }
}

export function AudioPlayer({ remoteUrl, localUri, isOwn }: AudioPlayerProps) {
  const [activated, setActivated] = useState(false)
  if (activated) {
    return <ActiveAudioPlayer remoteUrl={remoteUrl} localUri={localUri} isOwn={isOwn} />
  }
  return <IdleAudioPlayer isOwn={isOwn} onActivate={() => setActivated(true)} />
}

// Pre-play state: no native player exists yet. Tapping play spins one up.
function IdleAudioPlayer({ isOwn, onActivate }: { isOwn: boolean; onActivate: () => void }) {
  const { tint, trackBg, textColor } = palette(isOwn)
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.playBtn, { borderColor: tint }]}
        onPress={onActivate}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        activeOpacity={0.6}
      >
        <Play size={16} color={tint} fill={tint} strokeWidth={0} />
      </TouchableOpacity>
      <View style={styles.right}>
        <View style={styles.track}>
          <View style={[styles.trackBg, { backgroundColor: trackBg }]} />
        </View>
        <Text style={[styles.time, { color: textColor }]}>--:--</Text>
      </View>
    </View>
  )
}

// Playing state: holds the one live player for this clip. Auto-starts on mount
// (the user tapped play to get here) and thereafter play/pause/seek in place.
function ActiveAudioPlayer({ remoteUrl, localUri, isOwn }: AudioPlayerProps) {
  const headers = useAuthHeaders()
  const uri = localUri ?? remoteUrl ?? null
  const needsAuth = !localUri && !!remoteUrl
  // Hold the source until headers arrive so the remote request doesn't 401.
  // Memoized so its identity is stable across renders — otherwise the play-once
  // effect and the player would rebuild on every render.
  const source = useMemo(
    () => (uri && (!needsAuth || headers) ? { uri, headers: needsAuth ? headers! : undefined } : null),
    [uri, needsAuth, headers]
  )

  const player = useAudioPlayer(source)
  const status = useAudioPlayerStatus(player)

  const [trackWidth, setTrackWidth] = useState(0)
  const { tint, trackBg, textColor } = palette(isOwn)

  const duration = status.duration || 0
  const current = status.currentTime || 0
  const progress = duration > 0 ? Math.min(current / duration, 1) : 0

  // Auto-play once the clip has loaded — the user already tapped play to mount us.
  const started = useRef(false)
  useEffect(() => {
    if (!started.current && status.isLoaded && source) {
      started.current = true
      player.play()
    }
  }, [status.isLoaded, source, player])

  function togglePlay() {
    if (!source) return
    if (status.playing) {
      player.pause()
    } else {
      // Restart from the top once a clip has finished, otherwise play() is a no-op.
      if (status.didJustFinish || (duration > 0 && current >= duration - 0.05)) {
        void player.seekTo(0)
      }
      player.play()
    }
  }

  function seekTo(e: GestureResponderEvent) {
    if (!source || duration <= 0 || trackWidth <= 0) return
    const x = e.nativeEvent.locationX
    const fraction = Math.max(0, Math.min(x / trackWidth, 1))
    void player.seekTo(fraction * duration)
  }

  const ready = status.isLoaded
  const timeLabel = ready ? `${formatDuration(current)} / ${formatDuration(duration)}` : "--:--"

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.playBtn, { borderColor: tint }]}
        onPress={togglePlay}
        disabled={!ready}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        activeOpacity={0.6}
      >
        {status.playing ? (
          <Pause size={16} color={tint} fill={tint} strokeWidth={0} />
        ) : (
          <Play size={16} color={tint} fill={tint} strokeWidth={0} />
        )}
      </TouchableOpacity>

      <View style={styles.right}>
        <Pressable
          style={styles.track}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          onPress={seekTo}
          hitSlop={{ top: 8, bottom: 8 }}
        >
          <View style={[styles.trackBg, { backgroundColor: trackBg }]} />
          <View style={[styles.trackFill, { width: `${progress * 100}%`, backgroundColor: tint }]} />
        </Pressable>
        <Text style={[styles.time, { color: textColor }]}>{timeLabel}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 200,
    maxWidth: 260,
    paddingVertical: 2,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  right: {
    flex: 1,
    gap: 4,
  },
  track: {
    height: 16,
    justifyContent: "center",
  },
  trackBg: {
    height: 3,
    borderRadius: 1.5,
  },
  trackFill: {
    position: "absolute",
    left: 0,
    height: 3,
    borderRadius: 1.5,
  },
  time: {
    fontSize: 11,
    fontFamily: "InstrumentSans_500Medium",
  },
})
