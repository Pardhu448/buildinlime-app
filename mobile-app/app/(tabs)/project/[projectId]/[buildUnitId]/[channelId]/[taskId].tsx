import { useState } from "react"
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Alert,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLiveQuery, eq } from "@tanstack/react-db"
import * as Crypto from "expo-crypto"
import {
  tasksCollection,
  messagesCollection,
} from "@/src/application/collections/communication"
import { channelMembersCollection } from "@/src/application/collections/organization"
import {
  createPropertyAction,
  updatePropertyAction,
} from "@/src/application/actions/properties"
import { updateTaskAction, deleteTaskAction } from "@/src/application/actions/tasks"
import { createMessageAction } from "@/src/application/actions/messages"
import { usePropertiesByEntity } from "@/src/presentation/properties/hooks/useProperties"
import { ResourcesSheet } from "@/src/presentation/resources/components/ResourcesSheet"
import { BackHeader } from "@/src/presentation/shared/components/BackHeader"
import { TaskStatusControl } from "@/src/presentation/tasks/components/TaskStatusControl"
import { TaskDetailsFields } from "@/src/presentation/tasks/components/TaskDetailsFields"
import { TaskStatusHistory } from "@/src/presentation/tasks/components/TaskStatusHistory"
import { AssigneePickerModal } from "@/src/presentation/tasks/components/AssigneePickerModal"
import { buildStatusNoteText } from "@/src/presentation/tasks/lib/status-note"
import { useUsers } from "@/src/presentation/shared/hooks/useUsers"
import { useSession } from "@/src/infrastructure/auth/client"
import { colors } from "@/src/presentation/shared/colors"
import type { Message, Property, Task } from "@buildinlime/domain-types"

export default function TaskScreen() {
  const { projectId, buildUnitId, channelId, taskId } = useLocalSearchParams<{
    projectId: string
    buildUnitId: string
    channelId: string
    taskId: string
  }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data: session } = useSession()
  const currentUserId = session?.user?.id ?? ""

  const { data: taskRows } = useLiveQuery(
    (q) => q.from({ tasksCollection }).where(({ tasksCollection: t }) => eq(t.id, taskId)),
    [taskId]
  )
  const task = ((taskRows ?? []) as Task[])[0]

  const propsByEntity = usePropertiesByEntity("task")
  const properties = propsByEntity.get(taskId) ?? []
  const usersMap = useUsers()

  // No per-task "seen" write: under the timestamp model a task is seen once you
  // leave its channel (see the channel screen's markChannelSeen on unmount), which
  // covers every route in — the channel sheet, My Tasks, a deep link. Mirrors
  // web's TaskPage, which likewise marks nothing here.

  // Channel members — who a task can be assigned to. This MUST read the roster
  // (channelMembersCollection), not membershipsCollection: the latter is scoped
  // `user_id = me` server-side, so filtering it by channel yields exactly one row —
  // you — and the picker can never show anyone else.
  const { data: memberRows } = useLiveQuery(
    (q) =>
      q
        .from({ channelMembersCollection })
        .where(({ channelMembersCollection: m }) => eq(m.channel_id, channelId)),
    [channelId]
  )
  const memberIds = [
    ...new Set(((memberRows ?? []) as { user_id: string }[]).map((m) => m.user_id)),
  ]

  const [assignOpen, setAssignOpen] = useState(false)

  // The status change is a two-step: tap the pill, write a note, confirm.
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Status history. These are ordinary channel messages that carry this task's id,
  // so they cost no extra sync — messagesCollection is already open for the channel.
  // Newest first: the current state of the task is the thing you came to read.
  const { data: historyRows } = useLiveQuery(
    (q) =>
      q
        .from({ messagesCollection })
        .where(({ messagesCollection: m }) => eq(m.task_id, taskId)),
    [taskId]
  )
  const history = ((historyRows ?? []) as Message[])
    .slice()
    .sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

  if (!task) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  // A task should have exactly ONE taskStatus property. confirmStatusChange creates
  // one when it cannot find one, so a tap made before properties finished syncing
  // can leave a task with two rows that disagree about the status forever. Pick the
  // newest deterministically rather than trusting collection order, so a task that
  // already carries duplicates settles on one answer instead of flip-flopping.
  const taskStatus = properties
    .filter((p: Property) => p.type === "taskStatus")
    .sort(
      (a: Property, b: Property) =>
        new Date(b.created_at as unknown as string).getTime() -
        new Date(a.created_at as unknown as string).getTime()
    )[0]
  const completed = taskStatus
    ? taskStatus.task_status_value === "completed"
    : task.completed

  // Only the creator may assign or delete. The server enforces this (tasks.update
  // and tasks.delete return FORBIDDEN otherwise) — hiding the buttons is courtesy,
  // not the control.
  const canAssign = !!task.createdby_id && task.createdby_id === currentUserId
  const canDelete = canAssign

  function confirmDelete() {
    Alert.alert(
      "Delete task?",
      "The task and its attachments are removed for everyone. Notes already posted to the channel stay there.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteTaskAction({ id: taskId })
            router.back()
          },
        },
      ]
    )
  }

  /**
   * Completion is set through the taskStatus PROPERTY, not tasks.completed
   * directly: the properties router writes the column through in the same
   * transaction, so the pill and the My Tasks badge cannot disagree. Setting the
   * column here as well would be a second source of truth.
   */
  function applyStatus(next: "open" | "completed") {
    if (taskStatus) {
      updatePropertyAction({ id: taskStatus.id, patch: { task_status_value: next } })
      return
    }
    createPropertyAction({
      id: Crypto.randomUUID(),
      type: "taskStatus",
      entity: "task",
      entity_id: taskId,
      // Denormalized scope: a task property's channel is the task's channel.
      // Without it the row syncs back to nobody but its creator.
      channel_id: channelId,
      task_status_value: next,
    })
  }

  /** A status change must be explained — see buildStatusNoteText. */
  function confirmStatusChange() {
    const trimmed = note.trim()
    if (!trimmed || !currentUserId || submitting) return
    const next: "open" | "completed" = completed ? "open" : "completed"
    setSubmitting(true)
    try {
      createMessageAction({
        id: Crypto.randomUUID(),
        text: buildStatusNoteText({ taskName: task.name, next, note: trimmed }),
        channel_id: channelId,
        buildunit_id: buildUnitId,
        project_id: projectId,
        createdby_id: currentUserId,
        // What makes this message findable from the task screen. Without it the
        // note is only readable by scrolling the channel.
        task_id: taskId,
      })
      // Status flips only after the note is recorded, so a task can never end up
      // completed with no explanation in the channel.
      applyStatus(next)
      closeNote()
    } finally {
      setSubmitting(false)
    }
  }

  function closeNote() {
    setNote("")
    setNoteOpen(false)
    Keyboard.dismiss()
  }

  function assignTo(userId: string | null) {
    updateTaskAction({ id: taskId, patch: { assignee_id: userId } })
    setAssignOpen(false)
  }

  return (
    // "padding", not "height" — under edge-to-edge the window does not resize for
    // the keyboard, and "height" does not unwind cleanly on dismiss. Needed here
    // because the note input lives inside the scroll body. Same as the channel screen.
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <BackHeader
        title={task.name}
        onBack={() => router.back()}
        onDelete={canDelete ? confirmDelete : undefined}
        // Attachments for THIS task — same sheet as the channel's, in task mode.
        actions={
          <ResourcesSheet
            channelId={channelId}
            buildUnitId={buildUnitId}
            projectId={projectId}
            taskId={taskId}
          />
        }
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {task.description ? (
          <Text style={styles.description}>{task.description}</Text>
        ) : null}

        <TaskStatusControl
          completed={completed}
          noteOpen={noteOpen}
          onToggleNote={() => setNoteOpen((v) => !v)}
          note={note}
          onNoteChange={setNote}
          submitting={submitting}
          onCancel={closeNote}
          onConfirm={confirmStatusChange}
        />

        <TaskDetailsFields
          creatorName={usersMap[task.createdby_id] ?? "Unknown"}
          openedAt={task.opened_at}
          assigneeName={task.assignee_id ? usersMap[task.assignee_id] : undefined}
          canAssign={canAssign}
          onAssignPress={() => setAssignOpen(true)}
          properties={properties}
        />

        <TaskStatusHistory history={history} usersMap={usersMap} />
      </ScrollView>

      <AssigneePickerModal
        visible={assignOpen}
        onClose={() => setAssignOpen(false)}
        memberIds={memberIds}
        assigneeId={task.assignee_id ?? null}
        usersMap={usersMap}
        onAssign={assignTo}
      />
    </KeyboardAvoidingView>
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
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 18,
  },
  description: {
    fontSize: 14,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.foreground,
    lineHeight: 20,
  },
})
