import { useEffect } from "react"
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { CheckSquare, Square } from "lucide-react-native"
import { ScreenHeader } from "@/src/presentation/shared/components/ScreenHeader"
import { Breadcrumb } from "@/src/presentation/shared/components/Breadcrumb"
import { formatDateTime } from "@/src/presentation/shared/lib/datetime"
import { useLookups } from "@/src/presentation/shared/hooks/useLookups"
import { useTasks } from "@/src/presentation/tasks/hooks/useTasks"
import { useSeen } from "@/src/presentation/shared/hooks/useSeen"
import { useSession } from "@/src/infrastructure/auth/client"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import { colors } from "@/src/presentation/shared/colors"
import type { Task } from "@buildinlime/domain-types"

function TaskRow({
  task,
  lookups,
  onPress,
}: {
  task: Task
  lookups: ReturnType<typeof useLookups>
  onPress: () => void
}) {
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

function MyTasksContent() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data: session } = useSession()
  const currentUserId = session?.user?.id
  const { tasks, isLoading } = useTasks(currentUserId)
  const lookups = useLookups()
  const { markMyTasksSeen } = useSeen()

  // Leaving My Tasks marks it seen: one timestamp, pushed forward on unmount, so
  // the drawer's My Tasks badge clears. Mirrors web's MyTasksPage.
  useEffect(() => {
    return () => markMyTasksSeen()
  }, [markMyTasksSeen])

  // Open tasks first, newest first within each group.
  const sorted = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    return new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
  })

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (sorted.length === 0) {
    return (
      <View style={styles.centered}>
        <CheckSquare size={40} color={colors.cardBorder} strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>No tasks assigned to you</Text>
        <Text style={styles.emptyText}>Tasks assigned to you will appear here.</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={sorted}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      renderItem={({ item }) => (
        <TaskRow
          task={item}
          lookups={lookups}
          onPress={() => {
            const buildUnit = lookups.getBuildUnit(item.buildunit_id)
            if (!buildUnit || !item.channel_id) return
            // Straight to the task, not its channel. The task screen marks it read
            // on open, so the badge clears from any route in.
            router.push(
              `/(tabs)/project/${buildUnit.project_id}/${item.buildunit_id}/${item.channel_id}/${item.id}` as any
            )
          }}
        />
      )}
      showsVerticalScrollIndicator={false}
    />
  )
}

function MyTasksHeader() {
  const { data: session } = useSession()
  const { tasks } = useTasks(session?.user?.id)
  const openCount = tasks.filter((t) => !t.completed).length
  const doneCount = tasks.length - openCount

  return (
    <ScreenHeader
      title="My Tasks"
      subtitle={`${openCount} open · ${doneCount} done`}
    />
  )
}

export default function MyTasksScreen() {
  const { projectId } = useProjectContext()

  // Scoped collections are null until a project is initialized.
  if (!projectId) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="My Tasks" subtitle="Your assigned tasks" />
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Select a project to see your tasks.</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <MyTasksHeader />
      <MyTasksContent />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.mutedForeground,
    marginTop: 6,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  gap: {
    height: 8,
  },
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
