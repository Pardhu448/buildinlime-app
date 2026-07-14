import { useState } from "react"
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native"
import { splitExtension } from "@/src/presentation/resources/lib/attachment-format"
import { colors } from "@/src/presentation/shared/colors"

// Rename a queued attachment before it uploads. Used by the message composer,
// where attachments have no schedule step (they start when the message sends),
// so there is nowhere else to name them.

interface RenameFileModalProps {
  visible: boolean
  fileName: string
  onSave: (name: string) => void
  onCancel: () => void
}

export function RenameFileModal({
  visible,
  fileName,
  onSave,
  onCancel,
}: RenameFileModalProps) {
  const [baseName, extension] = splitExtension(fileName)
  const [draft, setDraft] = useState(baseName)

  const trimmed = draft.trim()
  const valid = trimmed.length > 0

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Rename file</Text>

          <View style={styles.nameRow}>
            <TextInput
              style={styles.nameInput}
              value={draft}
              onChangeText={setDraft}
              placeholder="File name"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={() => valid && onSave(`${trimmed}${extension}`)}
            />
            {extension ? <Text style={styles.extension}>{extension}</Text> : null}
          </View>
          {!valid && <Text style={styles.error}>Name cannot be empty.</Text>}

          <TouchableOpacity
            style={[styles.primaryBtn, !valid && styles.disabledBtn]}
            activeOpacity={0.8}
            disabled={!valid}
            onPress={() => onSave(`${trimmed}${extension}`)}
          >
            <Text style={styles.primaryBtnText}>Save</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.7} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
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
  error: {
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
