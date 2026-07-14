import { useEffect, useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  Keyboard,
  KeyboardAvoidingView,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLiveQuery, eq } from "@tanstack/react-db"
import * as Crypto from "expo-crypto"
import { CheckCircle2, Circle, UserPlus, X } from "lucide-react-native"
import {
  tasksCollection,
  messagesCollection,
} from "@/src/application/collections/communication"
import { channelMembersCollection } from "@/src/application/collections/organization"
import {
  createPropertyAction,
  updatePropertyAction,
} from "@/src/application/actions/properties"
import { updateTaskAction } from "@/src/application/actions/tasks"
import { createMessageAction } from "@/src/application/actions/messages"
import { usePropertiesByEntity } from "@/src/presentation/properties/hooks/useProperties"
import { PropertyPill } from "@/src/presentation/properties/components/PropertyPill"
import { ResourcesSheet } from "@/src/presentation/resources/components/ResourcesSheet"
import { useUsers } from "@/src/presentation/shared/hooks/useUsers"
import { useReads } from "@/src/presentation/shared/hooks/useReads"
import { formatDateTime } from "@/src/presentation/shared/lib/datetime"
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
  const { markTaskRead } = useReads()

  // Opening the task IS the "open" — mark it read here rather than at each call
  // site, so every route in counts (the channel sheet, My Tasks, a deep link).
  useEffect(() => {
    if (!taskId || !channelId) return
    markTaskRead(taskId, channelId)
  }, [taskId, channelId, markTaskRead])

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

  // Only the creator may assign. The server enforces this (tasks.update returns
  // FORBIDDEN otherwise) — hiding the button is courtesy, not the control.
  const canAssign = !!task.createdby_id && task.createdby_id === currentUserId

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

  /**
   * A status change must be explained. The note is posted as an ordinary channel
   * message — tasks have no notes table, and messages carry no task_id, so this
   * is a record in the channel rather than a history on the task. That is the
   * accepted trade: zero schema change, and the team sees the reason in context.
   *
   * The note is REQUIRED: Confirm stays disabled until it is non-empty.
   */
  function confirmStatusChange() {
    const trimmed = note.trim()
    if (!trimmed || !currentUserId || submitting) return
    const next: "open" | "completed" = completed ? "open" : "completed"
    setSubmitting(true)
    try {
      // messages.text is varchar(500). The note is the part worth keeping, so the
      // task name is what gets truncated if the two together would overflow.
      const label = next === "completed" ? `completed` : `reopened`
      const prefix = `Task ${label}: `
      const suffix = ` — ${trimmed}`
      const room = 500 - prefix.length - suffix.length
      const name =
        task.name.length > room && room > 1
          ? `${task.name.slice(0, room - 1)}…`
          : task.name
      createMessageAction({
        id: Crypto.randomUUID(),
        text: `${prefix}${name}${suffix}`.slice(0, 500),
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
      setNote("")
      setNoteOpen(false)
      Keyboard.dismiss()
    } finally {
      setSubmitting(false)
    }
  }

  function assignTo(userId: string | null) {
    updateTaskAction({ id: taskId, patch: { assignee_id: userId } })
    setAssignOpen(false)
  }

  const assigneeName = task.assignee_id ? usersMap[task.assignee_id] : undefined
  const creatorName = usersMap[task.createdby_id] ?? "Unknown"

  return (
    // "padding", not "height" — under edge-to-edge the window does not resize for
    // the keyboard, and "height" does not unwind cleanly on dismiss. Needed here
    // because the note input lives inside the scroll body. Same as the channel screen.
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.6}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {task.name}
        </Text>
        {/* Attachments for THIS task — same sheet as the channel's, in task mode. */}
        <ResourcesSheet
          channelId={channelId}
          buildUnitId={buildUnitId}
          projectId={projectId}
          taskId={taskId}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {task.description ? (
          <Text style={styles.description}>{task.description}</Text>
        ) : null}

        {/* Status — the one interactive control on this screen. It no longer flips
            on tap: it opens the note step below, and the note is what commits it. */}
        <TouchableOpacity
          style={[styles.statusBtn, completed && styles.statusBtnDone]}
          onPress={() => setNoteOpen((v) => !v)}
          activeOpacity={0.75}
        >
          {completed ? (
            <CheckCircle2 size={18} color="#166534" strokeWidth={2} />
          ) : (
            <Circle size={18} color={colors.primary} strokeWidth={2} />
          )}
          <Text style={[styles.statusText, completed && styles.statusTextDone]}>
            {completed ? "Completed" : "Open"}
          </Text>
          <Text style={styles.statusHint}>
            {completed ? "Tap to reopen" : "Tap to complete"}
          </Text>
        </TouchableOpacity>

        {noteOpen && (
          <View style={styles.noteSection}>
            <Text style={styles.noteTitle}>
              {completed ? "Why are you reopening this?" : "What was done?"}
            </Text>
            <Text style={styles.noteHint}>
              Required. Posted to the channel so the team sees the reason.
            </Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder={
                completed
                  ? "e.g. Rebar spacing is off, needs redoing"
                  : "e.g. Slab poured, cured 48h"
              }
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
              maxLength={400}
              autoFocus
              textAlignVertical="top"
            />
            <View style={styles.noteActions}>
              <TouchableOpacity
                onPress={() => {
                  setNote("")
                  setNoteOpen(false)
                  Keyboard.dismiss()
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.noteCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.noteSubmit,
                  (!note.trim() || submitting) && styles.noteSubmitDisabled,
                ]}
                onPress={confirmStatusChange}
                disabled={!note.trim() || submitting}
                activeOpacity={0.8}
              >
                <Text style={styles.noteSubmitText}>
                  {completed ? "Reopen Task" : "Mark Completed"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Created By</Text>
          <Text style={styles.fieldValue}>
            {creatorName} · {formatDateTime(task.opened_at)}
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Assigned To</Text>
          <View style={styles.assignRow}>
            <Text style={styles.fieldValue}>{assigneeName ?? "Unassigned"}</Text>
            {canAssign && (
              <TouchableOpacity
                style={styles.assignBtn}
                onPress={() => setAssignOpen(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <UserPlus size={14} color={colors.primary} strokeWidth={2} />
                <Text style={styles.assignBtnText}>Assign</Text>
              </TouchableOpacity>
            )}
          </View>
          {!canAssign && (
            <Text style={styles.fieldHint}>Only the task's creator can assign it.</Text>
          )}
        </View>

        {properties.length > 0 && (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Properties</Text>
            <View style={styles.pillRow}>
              {properties.map((p: Property) => (
                <PropertyPill key={p.id} property={p} />
              ))}
            </View>
          </View>
        )}

        {/* Status history — the notes posted with each status change, newest first.
            The message text is shown verbatim: it is the same message the channel
            shows, and re-parsing our own wording back apart would be a data model
            made of prose. */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Status History</Text>
          {history.length === 0 ? (
            <Text style={styles.fieldHint}>
              No status changes yet. Notes appear here when the status is changed.
            </Text>
          ) : (
            history.map((m) => (
              <View key={m.id} style={styles.historyRow}>
                <Text style={styles.historyText}>{m.text}</Text>
                <Text style={styles.historyMeta}>
                  {usersMap[m.createdby_id] ?? "Unknown"} ·{" "}
                  {formatDateTime(m.created_at)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Assignee picker */}
      <Modal
        visible={assignOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAssignOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setAssignOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Assign To</Text>
            <TouchableOpacity
              onPress={() => setAssignOpen(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.6}
            >
              <X size={18} color={colors.mutedForeground} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.sheetScroll}>
            <TouchableOpacity
              style={styles.memberRow}
              onPress={() => assignTo(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.memberName}>Unassigned</Text>
            </TouchableOpacity>
            {memberIds.map((id) => (
              <TouchableOpacity
                key={id}
                style={styles.memberRow}
                onPress={() => assignTo(id)}
                activeOpacity={0.7}
              >
                <Text style={styles.memberName}>{usersMap[id] ?? "Unknown"}</Text>
                {task.assignee_id === id && (
                  <CheckCircle2 size={16} color={colors.primary} strokeWidth={2} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  historyRow: {
    gap: 3,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.cardSurface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
  },
  historyText: {
    fontSize: 13,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.foreground,
    lineHeight: 18,
  },
  historyMeta: {
    fontSize: 11,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
  },
  noteSection: {
    gap: 6,
    marginTop: 10,
    padding: 12,
    backgroundColor: colors.cardSurface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
  },
  noteTitle: {
    fontSize: 14,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
  },
  noteHint: {
    fontSize: 11,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
  },
  noteInput: {
    minHeight: 72,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 8,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.foreground,
  },
  noteActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 14,
    marginTop: 4,
  },
  noteCancel: {
    fontSize: 13,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.mutedForeground,
  },
  noteSubmit: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  noteSubmitDisabled: {
    opacity: 0.4,
  },
  noteSubmitText: {
    fontSize: 13,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.primaryForeground,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: (StatusBar.currentHeight ?? 44) + 8,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  backButton: {
    padding: 4,
    marginRight: 4,
  },
  backArrow: {
    fontSize: 32,
    color: colors.primary,
    fontFamily: "InstrumentSans_400Regular",
    lineHeight: 32,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
    lineHeight: 22,
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
  statusBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.cardSurface,
  },
  statusBtnDone: {
    backgroundColor: "#16653411",
    borderColor: "#16653455",
  },
  statusText: {
    fontSize: 14,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
  },
  statusTextDone: {
    color: "#166534",
  },
  statusHint: {
    flex: 1,
    textAlign: "right",
    fontSize: 11,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
  },
  field: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 14,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.foreground,
  },
  fieldHint: {
    fontSize: 11,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
  },
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
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
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
