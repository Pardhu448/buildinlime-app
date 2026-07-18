import { useState } from "react"
import { useRouter } from "expo-router"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native"
import { ListTodo } from "lucide-react-native"
import { useSession } from "@/src/infrastructure/auth/client"
import { useChannelTasks } from "@/src/presentation/tasks/hooks/useChannelTasks"
import { useSeen } from "@/src/presentation/shared/hooks/useSeen"
import { useLookups } from "@/src/presentation/shared/hooks/useLookups"
import { createTaskAction } from "@/src/application/actions/tasks"
import { ChannelTaskRow } from "@/src/presentation/tasks/components/ChannelTaskRow"
import {
  BottomSheet,
  SheetTrigger,
  SheetActionButton,
  SheetScroll,
  SheetEmpty,
} from "@/src/presentation/shared/components/BottomSheet"
import { colors } from "@/src/presentation/shared/colors"
import { toDate } from "@buildinlime/contracts"

interface TasksSheetProps {
  channelId: string
  buildUnitId: string
  projectId: string
}

/**
 * Channel tasks behind a header button, mirroring the Resources sheet: a
 * half-screen scrollable sheet rather than a section, so tasks do not compete
 * with the message list for vertical space.
 *
 * Mirrors web's TasksRightPanel + AddTaskButton (ChannelPage): a list with an
 * open/complete circle, and an inline add form.
 */
export function TasksSheet({ channelId, buildUnitId, projectId }: TasksSheetProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const { data: session } = useSession()
  const { tasks } = useChannelTasks(channelId)
  const { isTaskUnseen } = useSeen()
  const { getUserName } = useLookups()

  // The badge counts what is NEW to you, not how many tasks exist — a count that
  // never goes down as you work tells you nothing. A task is unseen if it arrived
  // after you last opened this channel (the channel screen marks it seen on
  // leave); the channel's `seen` timestamp is shared across all its tasks.
  const unopenedCount = tasks.filter((t) => isTaskUnseen(t)).length

  // Open tasks first, newest first within each group — same order as My Tasks.
  const sorted = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    return toDate(b.opened_at).getTime() - toDate(a.opened_at).getTime()
  })

  function resetForm() {
    setName("")
    setDescription("")
    setAddOpen(false)
  }

  // Task names must be unique within a channel — the server enforces it with a
  // unique index, and web's task URL IS the name. Check here so the common case is
  // an inline message instead of a silently auto-suffixed name on sync.
  // Case-insensitive, matching the index's lower(name).
  const nameTaken = tasks.some(
    (t) => t.name.trim().toLowerCase() === name.trim().toLowerCase()
  )

  async function handleAdd() {
    const userId = session?.user?.id
    if (!userId) {
      Alert.alert("Cannot add task", "Your session is still loading — try again.")
      return
    }
    if (!name.trim() || nameTaken) return
    setSubmitting(true)
    try {
      createTaskAction({
        name: name.trim(),
        description: description.trim(),
        channel_id: channelId,
        buildunit_id: buildUnitId,
        createdby_id: userId,
      })
      resetForm()
    } catch (err) {
      Alert.alert("Could not add task", String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <SheetTrigger icon={ListTodo} count={unopenedCount} onPress={() => setOpen(true)} />

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Tasks"
        headerAction={
          <SheetActionButton label="Add" onPress={() => setAddOpen((v) => !v)} />
        }
        // The add form below holds a text input, and the sheet sits in the bottom
        // half of the screen where the keyboard opens.
        keyboardAware
      >
        {addOpen && (
          <View style={styles.addForm}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Task name"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Description (optional)"
              placeholderTextColor={colors.mutedForeground}
            />
            {nameTaken && (
              <Text style={styles.nameTaken}>
                A task with this name already exists in this channel.
              </Text>
            )}
            <View style={styles.addActions}>
              <TouchableOpacity onPress={resetForm} activeOpacity={0.7}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (!name.trim() || nameTaken) && styles.submitBtnDisabled,
                ]}
                onPress={handleAdd}
                disabled={!name.trim() || nameTaken || submitting}
                activeOpacity={0.8}
              >
                <Text style={styles.submitText}>
                  {submitting ? "Adding…" : "Add Task"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <SheetScroll persistTaps>
          {sorted.map((task) => (
            <ChannelTaskRow
              key={task.id}
              task={task}
              unread={isTaskUnseen(task)}
              assigneeName={task.assignee_id ? getUserName(task.assignee_id) : undefined}
              // The task screen marks it read on open — doing it here too would
              // be a second place to keep in step.
              onPress={() => {
                setOpen(false)
                router.push(
                  `/(tabs)/project/${projectId}/${buildUnitId}/${channelId}/${task.id}` as any
                )
              }}
            />
          ))}
          {sorted.length === 0 && (
            <SheetEmpty>No tasks yet. Tap Add to create one.</SheetEmpty>
          )}
        </SheetScroll>
      </BottomSheet>
    </>
  )
}

const styles = StyleSheet.create({
  addForm: {
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 8,
    backgroundColor: colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.foreground,
  },
  addActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 14,
  },
  nameTaken: {
    fontSize: 11,
    fontFamily: "InstrumentSans_400Regular",
    color: "#b91c1c",
  },
  cancelText: {
    fontSize: 13,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.mutedForeground,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitText: {
    fontSize: 13,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.primaryForeground,
  },
})
