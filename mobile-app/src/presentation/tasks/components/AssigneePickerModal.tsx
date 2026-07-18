import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native"
import { CheckCircle2, X } from "lucide-react-native"
import { colors } from "@/src/presentation/shared/colors"

interface AssigneePickerModalProps {
  visible: boolean
  onClose: () => void
  /** Channel roster — who this task can be assigned to. */
  memberIds: string[]
  assigneeId: string | null
  usersMap: Record<string, string>
  /** null clears the assignee. */
  onAssign: (userId: string | null) => void
}

/**
 * Picks a task's assignee from the channel roster.
 *
 * Not shared/CenteredModal: this one dismisses on an outside tap, which that
 * component deliberately does not do.
 */
export function AssigneePickerModal({
  visible,
  onClose,
  memberIds,
  assigneeId,
  usersMap,
  onAssign,
}: AssigneePickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Assign To</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <X size={18} color={colors.mutedForeground} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.sheetScroll}>
          <TouchableOpacity
            style={styles.memberRow}
            onPress={() => onAssign(null)}
            activeOpacity={0.7}
          >
            <Text style={styles.memberName}>Unassigned</Text>
          </TouchableOpacity>
          {memberIds.map((id) => (
            <TouchableOpacity
              key={id}
              style={styles.memberRow}
              onPress={() => onAssign(id)}
              activeOpacity={0.7}
            >
              <Text style={styles.memberName}>{usersMap[id] ?? "Unknown"}</Text>
              {assigneeId === id && (
                <CheckCircle2 size={16} color={colors.primary} strokeWidth={2} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  sheet: {
    position: "absolute",
    left: 24,
    right: 24,
    top: "30%",
    maxHeight: "45%",
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  sheetTitle: {
    fontSize: 15,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
  },
  sheetScroll: {
    marginTop: 6,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  memberName: {
    fontSize: 14,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.foreground,
  },
})
