import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native"
import { ScreenHeader } from "@/src/presentation/shared/components/ScreenHeader"
import { useTasks } from "@/src/presentation/tasks/hooks/useTasks"
import { useSession } from "@/src/infrastructure/auth/client"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import { colors } from "@/src/presentation/shared/colors"
import type { Task } from "@buildinlime/domain-types"

function TaskItem({ task }: { task: Task }) {
  return (
    <View style={styles.taskItem}>
      <View style={[styles.statusCircle, task.completed && styles.statusCircleCompleted]}>
        {task.completed && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.taskContent}>
        <Text
          style={[styles.taskName, task.completed && styles.taskNameCompleted]}
          numberOfLines={2}
        >
          {task.name}
        </Text>
        {task.description ? (
          <Text style={styles.taskDescription} numberOfLines={2}>
            {task.description}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

export default function MyTasksScreen() {
  const { data: session } = useSession()
  const { projectId } = useProjectContext()
  const currentUserId = session?.user?.id

  const { tasks, isLoading } = useTasks(currentUserId)

  return (
    <View style={styles.container}>
      <ScreenHeader title="My Tasks" subtitle="Your assigned tasks" />

      {!projectId ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Select a project to see your tasks.</Text>
        </View>
      ) : isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No tasks assigned to you.</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <TaskItem task={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
  },
  statusCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  statusCircleCompleted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.primaryForeground,
    fontSize: 12,
    fontFamily: "InstrumentSans_700Bold",
    lineHeight: 14,
  },
  taskContent: {
    flex: 1,
    gap: 3,
  },
  taskName: {
    fontSize: 14,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.foreground,
    lineHeight: 20,
  },
  taskNameCompleted: {
    color: colors.mutedForeground,
    textDecorationLine: "line-through",
  },
  taskDescription: {
    fontSize: 12,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
    lineHeight: 17,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 34,
  },
})
