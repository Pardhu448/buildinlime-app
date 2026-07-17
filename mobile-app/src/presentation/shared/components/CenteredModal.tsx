import { Modal, View, StyleSheet } from "react-native"
import type { ReactNode } from "react"
import { colors } from "@/src/presentation/shared/colors"

interface CenteredModalProps {
  visible: boolean
  /** Hardware back / system dismiss. The backdrop is not tap-to-dismiss —
      neither of the dialogs this was lifted from dismissed on an outside tap. */
  onRequestClose: () => void
  children: ReactNode
}

/**
 * A centred dialog over a dimmed backdrop — the shell RenameFileModal and
 * UploadScheduleModal each spelled out: a transparent fade Modal, the scrim, and
 * a rounded card holding the content. Both had the backdrop and sheet styles
 * character-for-character the same.
 *
 * This owns only the frame. Callers pass their own title, fields and buttons as
 * children. The bottom sheets (TasksSheet, ResourcesSheet) are a different
 * shape — slide up, tap-to-dismiss — and are not this.
 */
export function CenteredModal({ visible, onRequestClose, children }: CenteredModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>{children}</View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 20,
    gap: 10,
  },
})
