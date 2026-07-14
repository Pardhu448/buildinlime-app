import { useEffect, useState } from "react"
import { useRouter } from "expo-router"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  StyleSheet,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  useWindowDimensions,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ListTodo, Plus, X, CheckCircle2, Circle } from "lucide-react-native"
import { useSession } from "@/src/infrastructure/auth/client"
import { useChannelTasks } from "@/src/presentation/tasks/hooks/useChannelTasks"
import { useReads } from "@/src/presentation/shared/hooks/useReads"
import { useLookups } from "@/src/presentation/shared/hooks/useLookups"
import { createTaskAction } from "@/src/application/actions/tasks"
import { formatDateTime } from "@/src/presentation/shared/lib/datetime"
import { colors } from "@/src/presentation/shared/colors"
import type { Task } from "@buildinlime/domain-types"

interface TasksSheetProps {
  channelId: string
  buildUnitId: string
  projectId: string
}

function TaskRow({
  task,
  unread,
  assigneeName,
  onPress,
}: {
  task: Task
  unread: boolean
  assigneeName?: string
  onPress: () => void
}) {
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

  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const { data: session } = useSession()

  // Same rule as MessageInput: the nav-bar inset must not be applied while the
  // keyboard is up. The KeyboardAvoidingView already lifts the sheet clear of the
  // keyboard, and the nav bar is behind the keyboard at that point — adding its
  // height on top pushes the sheet a nav-bar's worth too high.
  const [keyboardUp, setKeyboardUp] = useState(false)
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardUp(true))
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardUp(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  const { tasks } = useChannelTasks(channelId)
  const { isTaskUnread } = useReads()
  const { getUserName } = useLookups()

  // The badge counts what is NEW to you, not how many tasks exist — a count that
  // never goes down as you work tells you nothing.
  const unopenedCount = tasks.filter((t) => isTaskUnread(t.id)).length

  // Open tasks first, newest first within each group — same order as My Tasks.
  const sorted = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    return new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
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
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
      >
        <ListTodo size={20} color={colors.primary} strokeWidth={2} />
        {unopenedCount > 0 ? (
          <View style={styles.countBadge}>
            {/* numberOfLines={1}: a constrained badge would otherwise WRAP a
                two-digit count and show only the first digit. */}
            <Text style={styles.countText} numberOfLines={1}>
              {unopenedCount > 99 ? "99+" : unopenedCount}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        {/* The sheet is pinned to the bottom half of the screen — exactly where the
            keyboard opens — so the add form is covered unless something lifts it.
            "padding" on both platforms, NOT "height": under edge-to-edge the window
            does not resize for the keyboard, and "height" lifts by shrinking and
            does not fully unwind on dismiss. Same choice as the channel screen. */}
        <KeyboardAvoidingView
          style={styles.modalBody}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

          <View
            style={[
              styles.sheet,
              { height: height * 0.5, paddingBottom: keyboardUp ? 0 : insets.bottom },
            ]}
          >
            <View style={styles.grabber} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Tasks</Text>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => setAddOpen((v) => !v)}
                activeOpacity={0.7}
              >
                <Plus size={14} color={colors.primaryForeground} strokeWidth={2.5} />
                <Text style={styles.addText}>Add</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.6}
              >
                <X size={18} color={colors.mutedForeground} strokeWidth={2} />
              </TouchableOpacity>
            </View>

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

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              {sorted.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  unread={isTaskUnread(task.id)}
                  assigneeName={
                    task.assignee_id ? getUserName(task.assignee_id) : undefined
                  }
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
                <Text style={styles.empty}>No tasks yet. Tap Add to create one.</Text>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  // The badge sits INSIDE the trigger's box — see the note in ResourcesSheet. It
  // was pinned outside (top: -2, right: -4), where Android clips it: a two-digit
  // count grows the badge past the edge and the last digit is lost. The resources
  // badge hit this first, but a channel with 10+ tasks would have hit it here too.
  trigger: {
    paddingTop: 9,
    paddingRight: 12,
    paddingBottom: 6,
    paddingLeft: 6,
  },
  countBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontSize: 10,
    lineHeight: 13,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.primaryForeground,
  },
  modalBody: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    // The height is fixed at half the screen, but a keyboard taller than that
    // would leave no room for it — shrink instead of running off the bottom.
    flexShrink: 1,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cardBorder,
    marginTop: 8,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  sheetTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addText: {
    fontSize: 12,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.primaryForeground,
  },
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 10,
    gap: 8,
  },
  empty: {
    fontSize: 13,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
    textAlign: "center",
    paddingVertical: 24,
  },
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
