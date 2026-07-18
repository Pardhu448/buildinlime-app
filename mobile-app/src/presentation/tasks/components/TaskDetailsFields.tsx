import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { UserPlus } from "lucide-react-native"
import { TaskField, FieldValue, FieldHint } from "./TaskField"
import { PropertyPill } from "@/src/presentation/properties/components/PropertyPill"
import { formatDateTime } from "@/src/presentation/shared/lib/datetime"
import { colors } from "@/src/presentation/shared/colors"
import type { Property } from "@buildinlime/domain-types"

interface TaskDetailsFieldsProps {
  creatorName: string
  /** Passed through to formatDateTime, which takes either form. */
  openedAt: Date | string
  assigneeName?: string
  /**
   * Creator-only. The server enforces it (tasks.update returns FORBIDDEN
   * otherwise) — hiding the button is courtesy, not the control.
   */
  canAssign: boolean
  onAssignPress: () => void
  properties: Property[]
}

/** The task's read-only detail blocks: who opened it, who owns it, its properties. */
export function TaskDetailsFields({
  creatorName,
  openedAt,
  assigneeName,
  canAssign,
  onAssignPress,
  properties,
}: TaskDetailsFieldsProps) {
  return (
    <>
      <TaskField label="Created By">
        <FieldValue>
          {creatorName} · {formatDateTime(openedAt)}
        </FieldValue>
      </TaskField>

      <TaskField label="Assigned To">
        <View style={styles.assignRow}>
          <FieldValue>{assigneeName ?? "Unassigned"}</FieldValue>
          {canAssign && (
            <TouchableOpacity
              style={styles.assignBtn}
              onPress={onAssignPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <UserPlus size={14} color={colors.primary} strokeWidth={2} />
              <Text style={styles.assignBtnText}>Assign</Text>
            </TouchableOpacity>
          )}
        </View>
        {!canAssign && <FieldHint>Only the task's creator can assign it.</FieldHint>}
      </TaskField>

      {properties.length > 0 && (
        <TaskField label="Properties">
          <View style={styles.pillRow}>
            {properties.map((p) => (
              <PropertyPill key={p.id} property={p} />
            ))}
          </View>
        </TaskField>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  assignRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  assignBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  assignBtnText: {
    fontSize: 12,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.primary,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
})
