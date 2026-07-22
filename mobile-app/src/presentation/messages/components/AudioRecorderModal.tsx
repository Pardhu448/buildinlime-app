import { useState } from "react"
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native"
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio"
import { Mic, Square, Trash2, Check } from "lucide-react-native"
import { colors } from "@/src/presentation/shared/colors"
import { formatDuration } from "@/src/presentation/resources/lib/attachment-format"
import type { CapturedFile } from "@/src/presentation/messages/lib/capture"

// A record → stop → attach flow for a voice message. The recorded clip renders
// inline (as an AudioPlayer) once attached, so there is no preview player here —
// this modal only captures the file and hands it back.

interface AudioRecorderModalProps {
  visible: boolean
  onSave: (file: CapturedFile) => void
  onClose: () => void
}

// .m4a container, AAC audio — audio/mp4 is its registered type and plays on both
// platforms; the `audio/` prefix is what routes it to the inline player.
const AUDIO_MIME = "audio/mp4"

export function AudioRecorderModal({ visible, onSave, onClose }: AudioRecorderModalProps) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const state = useAudioRecorderState(recorder)
  // Set once the recording is stopped; presence of a uri means "ready to attach".
  const [recordedUri, setRecordedUri] = useState<string | null>(null)
  const [recordedMs, setRecordedMs] = useState(0)
  const [busy, setBusy] = useState(false)

  async function startRecording() {
    try {
      const perm = await requestRecordingPermissionsAsync()
      if (!perm.granted) {
        Alert.alert("Microphone off", "Enable microphone access in Settings to record audio.")
        return
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      recorder.record()
    } catch (err) {
      Alert.alert("Could not start recording", String(err))
    }
  }

  async function stopRecording() {
    try {
      setRecordedMs(state.durationMillis)
      await recorder.stop()
      setRecordedUri(recorder.uri)
    } catch (err) {
      Alert.alert("Could not stop recording", String(err))
    } finally {
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {})
    }
  }

  // Reset transient state and hand control back to the composer.
  function dismiss() {
    setRecordedUri(null)
    setRecordedMs(0)
    setBusy(false)
    onClose()
  }

  async function reset() {
    if (state.isRecording) await recorder.stop().catch(() => {})
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {})
    setRecordedUri(null)
    setRecordedMs(0)
  }

  function attach() {
    if (!recordedUri || busy) return
    setBusy(true)
    onSave({
      uri: recordedUri,
      name: `voice-${Date.now()}.m4a`,
      mimeType: AUDIO_MIME,
    })
    dismiss()
  }

  const elapsedMs = recordedUri ? recordedMs : state.durationMillis
  const timeLabel = formatDuration(elapsedMs / 1000)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {recordedUri ? "Recording ready" : state.isRecording ? "Recording…" : "Record audio"}
          </Text>

          <Text style={styles.timer}>{timeLabel}</Text>

          {/* Idle → big mic; recording → stop; recorded → discard / attach. */}
          {recordedUri ? (
            <View style={styles.recordedRow}>
              <TouchableOpacity style={[styles.pill, styles.pillMuted]} onPress={reset} activeOpacity={0.7}>
                <Trash2 size={18} color={colors.mutedForeground} strokeWidth={2} />
                <Text style={styles.pillMutedText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pill, styles.pillPrimary]} onPress={attach} activeOpacity={0.7}>
                <Check size={18} color={colors.primaryForeground} strokeWidth={2.5} />
                <Text style={styles.pillPrimaryText}>Attach</Text>
              </TouchableOpacity>
            </View>
          ) : state.isRecording ? (
            <TouchableOpacity style={[styles.bigBtn, styles.stopBtn]} onPress={stopRecording} activeOpacity={0.7}>
              <Square size={26} color="#fff" fill="#fff" strokeWidth={0} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.bigBtn, styles.recordBtn]} onPress={startRecording} activeOpacity={0.7}>
              <Mic size={30} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.cancel} onPress={dismiss} activeOpacity={0.6}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: colors.background,
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 16,
  },
  title: {
    fontSize: 15,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
  },
  timer: {
    fontSize: 34,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  bigBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  recordBtn: {
    backgroundColor: colors.primary,
  },
  stopBtn: {
    backgroundColor: colors.destructive,
  },
  recordedRow: {
    flexDirection: "row",
    gap: 12,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
  },
  pillMuted: {
    backgroundColor: colors.muted,
  },
  pillMutedText: {
    fontSize: 14,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.mutedForeground,
  },
  pillPrimary: {
    backgroundColor: colors.primary,
  },
  pillPrimaryText: {
    fontSize: 14,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.primaryForeground,
  },
  cancel: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.mutedForeground,
  },
})
