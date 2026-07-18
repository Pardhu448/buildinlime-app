import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native"
import { CheckCircle2, Circle } from "lucide-react-native"
import { colors } from "@/src/presentation/shared/colors"

interface TaskStatusControlProps {
  completed: boolean
  /** Whether the note step is expanded. */
  noteOpen: boolean
  onToggleNote: () => void
  note: string
  onNoteChange: (text: string) => void
  submitting: boolean
  onCancel: () => void
  onConfirm: () => void
}

/**
 * The status pill and its note step — the one interactive control on the task
 * screen.
 *
 * Tapping the pill does NOT flip the status: it opens the note step, and the
 * note is what commits the change. The note is REQUIRED, so Confirm stays
 * disabled until it is non-empty.
 */
export function TaskStatusControl({
  completed,
  noteOpen,
  onToggleNote,
  note,
  onNoteChange,
  submitting,
  onCancel,
  onConfirm,
}: TaskStatusControlProps) {
  const canSubmit = !!note.trim() && !submitting

  return (
    <>
      <TouchableOpacity
        style={[styles.statusBtn, completed && styles.statusBtnDone]}
        onPress={onToggleNote}
        activeOpacity={0.75}
      >
        {completed ? (
          <CheckCircle2 size={18} color="#166534" strokeWidth={2} />
        ) : (
          <Circle size={18} color={colors.primary} strokeWidth={2} />
        )}
        <Text style={[styles.statusText, completed && styles.statusTextDone]}>
          {completed ? "Completed" : "Open"}
        </Text>
        <Text style={styles.statusHint}>
          {completed ? "Tap to reopen" : "Tap to complete"}
        </Text>
      </TouchableOpacity>

      {noteOpen && (
        <View style={styles.noteSection}>
          <Text style={styles.noteTitle}>
            {completed ? "Why are you reopening this?" : "What was done?"}
          </Text>
          <Text style={styles.noteHint}>
            Required. Posted to the channel so the team sees the reason.
          </Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={onNoteChange}
            placeholder={
              completed
                ? "e.g. Rebar spacing is off, needs redoing"
                : "e.g. Slab poured, cured 48h"
            }
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            maxLength={400}
            autoFocus
            textAlignVertical="top"
          />
          <View style={styles.noteActions}>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.noteCancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.noteSubmit, !canSubmit && styles.noteSubmitDisabled]}
              onPress={onConfirm}
              disabled={!canSubmit}
              activeOpacity={0.8}
            >
              <Text style={styles.noteSubmitText}>
                {completed ? "Reopen Task" : "Mark Completed"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  statusBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.cardSurface,
  },
  statusBtnDone: {
    backgroundColor: "#16653411",
    borderColor: "#16653455",
  },
  statusText: {
    fontSize: 14,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
  },
  statusTextDone: {
    color: "#166534",
  },
  statusHint: {
    flex: 1,
    textAlign: "right",
    fontSize: 11,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
  },
  noteSection: {
    gap: 6,
    marginTop: 10,
    padding: 12,
    backgroundColor: colors.cardSurface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
  },
  noteTitle: {
    fontSize: 14,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
  },
  noteHint: {
    fontSize: 11,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
  },
  noteInput: {
    minHeight: 72,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 8,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.foreground,
  },
  noteActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 14,
    marginTop: 4,
  },
  noteCancel: {
    fontSize: 13,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.mutedForeground,
  },
  noteSubmit: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  noteSubmitDisabled: {
    opacity: 0.4,
  },
  noteSubmitText: {
    fontSize: 13,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.primaryForeground,
  },
})
