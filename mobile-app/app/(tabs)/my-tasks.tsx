import { useCallback } from "react"
import { View, StyleSheet } from "react-native"
import { useRouter, useFocusEffect } from "expo-router"
import { CheckSquare } from "lucide-react-native"
import { ScreenHeader } from "@/src/presentation/shared/components/ScreenHeader"
import { CardList } from "@/src/presentation/shared/components/CardList"
import { LoadingState, EmptyState } from "@/src/presentation/shared/components/ScreenStates"
import { MyTaskRow } from "@/src/presentation/tasks/components/MyTaskRow"
import { useLookups } from "@/src/presentation/shared/hooks/useLookups"
import { useTasks } from "@/src/presentation/tasks/hooks/useTasks"
import { useSeen } from "@/src/presentation/shared/hooks/useSeen"
import { useSession } from "@/src/infrastructure/auth/client"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import { colors } from "@/src/presentation/shared/colors"
import { toDate } from "@buildinlime/contracts"

function MyTasksContent() {
  const router = useRouter()
  const { data: session } = useSession()
  const currentUserId = session?.user?.id
  const { tasks, isLoading } = useTasks(currentUserId)
  const lookups = useLookups()
  const { markMyTasksSeen } = useSeen()

  // Leaving My Tasks marks it seen so the drawer's My Tasks badge clears.
  // useFocusEffect (cleanup runs on BLUR), NOT useEffect: the Drawer keeps this
  // screen mounted across drawer navigation, so an unmount cleanup would never
  // fire and the badge would go stale. Mirrors web's MyTasksPage unmount.
  useFocusEffect(
    useCallback(() => {
      return () => markMyTasksSeen()
    }, [markMyTasksSeen])
  )

  // Open tasks first, newest first within each group.
  const sorted = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    return toDate(b.opened_at).getTime() - toDate(a.opened_at).getTime()
  })

  if (isLoading) return <LoadingState />

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={CheckSquare}
        title="No tasks assigned to you"
        message="Tasks assigned to you will appear here."
      />
    )
  }

  return (
    <CardList
      data={sorted}
      keyExtractor={(item) => item.id}
      renderItem={(item) => (
        <MyTaskRow
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
    />
  )
}

function MyTasksHeader() {
  const { data: session } = useSession()
  const { tasks } = useTasks(session?.user?.id)
  const openCount = tasks.filter((t) => !t.completed).length
  const doneCount = tasks.length - openCount

  return <ScreenHeader title="My Tasks" subtitle={`${openCount} open · ${doneCount} done`} />
}

export default function MyTasksScreen() {
  const { projectId } = useProjectContext()

  // Scoped collections are null until a project is initialized.
  if (!projectId) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="My Tasks" subtitle="Your assigned tasks" />
        <EmptyState message="Select a project to see your tasks." />
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
})
