import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { CheckCircle2, Circle } from "lucide-react-native"
import { formatDateTime } from "@/src/presentation/shared/lib/datetime"
import { colors } from "@/src/presentation/shared/colors"
import type { Task } from "@buildinlime/domain-types"

interface ChannelTaskRowProps {
  task: Task
  /** Arrived since you last opened this channel — see useSeen. */
  unread: boolean
  assigneeName?: string
  onPress: () => void
}

/**
 * One task in the channel's Tasks sheet.
 *
 * Not MyTaskRow: that one is the cross-project My Tasks list and carries a
 * breadcrumb to locate the task. Here the channel is already the context, so the
 * row spends its space on the unread state instead.
 */
export function ChannelTaskRow({
  task,
  unread,
  assigneeName,
  onPress,
}: ChannelTaskRowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, unread && styles.rowUnread]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {task.completed ? (
        <CheckCircle2 size={18} color="#166534" strokeWidth={2} />
      ) : (
        <Circle
          size={18}
          color={unread ? colors.primary : colors.mutedForeground}
          strokeWidth={2}
          {...(unread ? { fill: colors.primary } : {})}
        />
      )}

      <View style={styles.rowBody}>
        <Text
          style={[
            styles.taskName,
            unread && styles.taskNameUnread,
            task.completed && styles.taskNameCompleted,
          ]}
          numberOfLines={2}
        >
          {task.name}
        </Text>
        {task.description ? (
          <Text style={styles.taskDescription} numberOfLines={2}>
            {task.description}
          </Text>
        ) : null}
        <Text style={styles.taskMeta} numberOfLines={1}>
          {assigneeName ? `${assigneeName} · ` : "Unassigned · "}
          {formatDateTime(task.opened_at)}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
  },
  rowUnread: {
    backgroundColor: colors.cardSurface,
    borderColor: colors.secondary,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  taskName: {
    fontSize: 13,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.foreground,
    lineHeight: 18,
  },
  taskNameUnread: {
    fontFamily: "InstrumentSans_600SemiBold",
  },
  taskNameCompleted: {
    color: colors.mutedForeground,
    textDecorationLine: "line-through",
  },
  taskDescription: {
    fontSize: 12,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
  },
  taskMeta: {
    fontSize: 11,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
    marginTop: 2,
  },
})
