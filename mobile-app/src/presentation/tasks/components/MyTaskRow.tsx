import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { CheckSquare, Square } from "lucide-react-native"
import { Breadcrumb } from "@/src/presentation/shared/components/Breadcrumb"
import { formatDateTime } from "@/src/presentation/shared/lib/datetime"
import { useLookups } from "@/src/presentation/shared/hooks/useLookups"
import { colors } from "@/src/presentation/shared/colors"
import type { Task } from "@buildinlime/domain-types"

interface MyTaskRowProps {
  task: Task
  /** Passed in rather than called here: one hook for the list, not one per row. */
  lookups: ReturnType<typeof useLookups>
  onPress: () => void
}

/** One assigned task in the My Tasks list, with the path that locates it. */
export function MyTaskRow({ task, lookups, onPress }: MyTaskRowProps) {
  const { getChannel, getBuildUnit, getProject } = lookups

  const channel = getChannel(task.channel_id)
  const buildUnit = getBuildUnit(task.buildunit_id)
  const project = getProject(buildUnit?.project_id)

  return (
    <TouchableOpacity
      style={[styles.row, task.completed && styles.rowCompleted]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.checkbox}>
        {task.completed ? (
          <CheckSquare size={16} color={colors.primary} strokeWidth={2} />
        ) : (
          <Square size={16} color={colors.primary} strokeWidth={2} />
        )}
      </View>
      <View style={styles.rowBody}>
        <Text
          style={[styles.taskName, task.completed && styles.taskNameCompleted]}
          numberOfLines={2}
        >
          {task.name}
        </Text>
        {task.description ? (
          <Text style={styles.taskDescription} numberOfLines={1}>
            {task.description}
          </Text>
        ) : null}
        <Text style={styles.taskDate}>
          {task.completed
            ? `Completed ${formatDateTime(task.closed_at)}`
            : `Opened ${formatDateTime(task.opened_at)}`}
        </Text>
        <Breadcrumb
          projectName={project?.name}
          buildUnitName={buildUnit?.name}
          channelName={channel?.name}
        />
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.cardSurface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
  },
  rowCompleted: {
    backgroundColor: colors.background,
    opacity: 0.6,
  },
  checkbox: {
    marginTop: 2,
  },
  rowBody: {
    flex: 1,
  },
  taskName: {
    fontSize: 13,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
    lineHeight: 19,
  },
  taskNameCompleted: {
    color: colors.mutedForeground,
    textDecorationLine: "line-through",
  },
  taskDescription: {
    fontSize: 12,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
    marginTop: 2,
  },
  taskDate: {
    fontSize: 11,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
    marginTop: 3,
  },
})
