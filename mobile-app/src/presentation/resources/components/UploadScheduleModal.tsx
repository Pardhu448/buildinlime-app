import { useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native"
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker"
import { splitExtension } from "@/src/presentation/resources/lib/attachment-format"
import { colors } from "@/src/presentation/shared/colors"
import { CenteredModal } from "@/src/presentation/shared/components/CenteredModal"

// Name the file and choose when it uploads: immediately, or at a future
// date/time. Mobile counterpart of web's upload-schedule-popover.
//
// The native picker only handles one field at a time, so a scheduled time is
// collected in two steps: date, then time.

interface UploadScheduleModalProps {
  visible: boolean
  fileName: string
  /** Both callbacks carry the (possibly renamed) file name. */
  onUploadNow: (name: string) => void
  onSchedule: (when: Date, name: string) => void
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

  const [baseName, extension] = splitExtension(fileName)
  const [draftName, setDraftName] = useState(baseName)

  const trimmed = draftName.trim()
  const nameValid = trimmed.length > 0
  const finalName = `${trimmed}${extension}`

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
    <CenteredModal
      visible={visible}
      onRequestClose={() => {
        reset()
        onCancel()
      }}
    >
      <Text style={styles.title}>Upload file</Text>

      {/* Rename before it goes out — this becomes the resource's name. */}
      <Text style={styles.fieldLabel}>File name</Text>
      <View style={styles.nameRow}>
        <TextInput
          style={styles.nameInput}
          value={draftName}
          onChangeText={setDraftName}
          placeholder="File name"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          selectTextOnFocus
          returnKeyType="done"
        />
        {extension ? (
          <Text style={styles.extension}>{extension}</Text>
        ) : null}
      </View>
      {!nameValid && (
        <Text style={styles.nameError}>Name cannot be empty.</Text>
      )}

      <TouchableOpacity
        style={[styles.primaryBtn, !nameValid && styles.disabledBtn]}
        activeOpacity={0.8}
        disabled={!nameValid}
        onPress={() => {
          const name = finalName
          reset()
          onUploadNow(name)
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
        style={[
          styles.primaryBtn,
          (!canSchedule || !nameValid) && styles.disabledBtn,
        ]}
        activeOpacity={0.8}
        disabled={!canSchedule || !nameValid}
        onPress={() => {
          if (!selected) return
          const when = selected
          const name = finalName
          reset()
          onSchedule(when, name)
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
    </CenteredModal>
  )
}

const styles = StyleSheet.create({
  title: {
    fontSize: 15,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 8,
    backgroundColor: colors.muted,
    paddingHorizontal: 10,
  },
  nameInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.foreground,
  },
  extension: {
    fontSize: 14,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.mutedForeground,
  },
  nameError: {
    fontSize: 11,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.destructive,
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
