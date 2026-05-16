import { useState } from "react"
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native"
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker"
import { colors } from "@/src/presentation/shared/colors"

// Choose when a freshly-picked file uploads: immediately, or at a future
// date/time. Mobile counterpart of web's upload-schedule-popover.
//
// The native picker only handles one field at a time, so a scheduled time is
// collected in two steps: date, then time.

interface UploadScheduleModalProps {
  visible: boolean
  fileName: string
  onUploadNow: () => void
  onSchedule: (when: Date) => void
  /** Dismiss without uploading — the caller cancels the pending upload. */
  onCancel: () => void
}

type PickerStage = "date" | "time" | null

function defaultFuture(): Date {
  return new Date(Date.now() + 60 * 60 * 1000) // one hour out
}

export function UploadScheduleModal({
  visible,
  fileName,
  onUploadNow,
  onSchedule,
  onCancel,
}: UploadScheduleModalProps) {
  const [stage, setStage] = useState<PickerStage>(null)
  const [draftDate, setDraftDate] = useState<Date>(defaultFuture())
  const [selected, setSelected] = useState<Date | null>(null)

  function reset() {
    setStage(null)
    setDraftDate(defaultFuture())
    setSelected(null)
  }

  function handlePickerChange(event: DateTimePickerEvent, value?: Date) {
    if (event.type === "dismissed" || !value) {
      setStage(null)
      return
    }
    if (stage === "date") {
      // Carry the Y/M/D; the time step overwrites H:M next.
      setDraftDate(value)
      setStage("time")
      return
    }
    // stage === "time"
    const merged = new Date(draftDate)
    merged.setHours(value.getHours(), value.getMinutes(), 0, 0)
    setSelected(merged)
    setStage(null)
  }

  const canSchedule = selected !== null && selected.getTime() > Date.now()

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        reset()
        onCancel()
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title} numberOfLines={1}>
            Upload “{fileName}”
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.8}
            onPress={() => {
              reset()
              onUploadNow()
            }}
          >
            <Text style={styles.primaryBtnText}>Upload now</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.7}
            onPress={() => setStage("date")}
          >
            <Text style={styles.secondaryBtnText}>
              {selected
                ? `📅 ${selected.toLocaleString()}`
                : "📅 Pick a date & time"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryBtn, !canSchedule && styles.disabledBtn]}
            activeOpacity={0.8}
            disabled={!canSchedule}
            onPress={() => {
              if (!selected) return
              const when = selected
              reset()
              onSchedule(when)
            }}
          >
            <Text style={styles.primaryBtnText}>Schedule upload</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            activeOpacity={0.7}
            onPress={() => {
              reset()
              onCancel()
            }}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          {stage && (
            <DateTimePicker
              value={stage === "time" ? draftDate : selected ?? draftDate}
              mode={stage}
              minimumDate={stage === "date" ? new Date() : undefined}
              onChange={handlePickerChange}
            />
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 20,
    gap: 10,
  },
  title: {
    fontSize: 15,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
    marginBottom: 4,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontFamily: "InstrumentSans_600SemiBold",
  },
  disabledBtn: {
    opacity: 0.4,
  },
  secondaryBtn: {
    backgroundColor: colors.muted,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: colors.foreground,
    fontSize: 14,
    fontFamily: "InstrumentSans_500Medium",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  cancelBtn: {
    paddingVertical: 8,
    alignItems: "center",
  },
  cancelBtnText: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontFamily: "InstrumentSans_500Medium",
  },
})
