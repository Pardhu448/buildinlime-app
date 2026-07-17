import { useState } from "react"
import { CheckCircle2, Circle } from "lucide-react"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { messagesCollection } from "%/application/collections/communication"
import { usersCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { createPropertyAction, updatePropertyAction } from "%/application/actions/properties"
import { createMessageAction } from "%/application/actions/messages"
import { formatDateTime } from "%/presentation/lib/datetime"
import type { Property } from "%/domain/communication/types"

interface TaskStatusSectionProps {
  taskId: string
  taskName: string
  channelId: string
  buildUnitId: string
  projectId: string
  currentUserId: string
  /** All properties on this task — the taskStatus one is the source of truth. */
  properties: Property[]
  /** tasks.completed, used only when no taskStatus property exists yet. */
  completed: boolean
}

/**
 * The one place a task's status can be changed, and the history of those changes.
 *
 * Status is deliberately NOT editable through PropertiesInline any more, even
 * though taskStatus is a property type: a status change must be explained, and a
 * second edit path would be a way to complete a task without a note. Mirrors the
 * mobile task screen — keep the two in step.
 */
export function TaskStatusSection({
  taskId,
  taskName,
  channelId,
  buildUnitId,
  projectId,
  currentUserId,
  properties,
  completed: completedColumn,
}: TaskStatusSectionProps) {
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // A task should have exactly ONE taskStatus property, but a page that rendered
  // before properties finished loading could create a second (see use-task-route).
  // Pick the newest deterministically rather than trusting collection order, so a
  // task carrying duplicates settles on one answer instead of flip-flopping.
  const taskStatus = properties
    .filter((p) => p.type === "taskStatus")
    .sort(
      (a, b) =>
        new Date(b.created_at as unknown as string).getTime() -
        new Date(a.created_at as unknown as string).getTime(),
    )[0]
  const completed = taskStatus
    ? taskStatus.task_status_value === "completed"
    : completedColumn

  // The notes posted with each status change. These are ordinary channel
  // messages carrying this task's id, so they cost no extra sync — the messages
  // collection is already open for the channel. Newest first: the current state
  // of the task is what you came to read.
  const { data: historyRows } = useLiveQuery(
    (q) =>
      q
        .from({ messagesCollection })
        .where(({ messagesCollection: m }) => eq(m.task_id, taskId)),
    [taskId],
  )
  const { data: allUsers } = useLiveQuery((q) => q.from({ usersCollection }), [])

  const history = (historyRows ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at as string).getTime() -
        new Date(a.created_at as string).getTime(),
    )

  const authorName = (userId: string) => {
    const u = (allUsers ?? []).find((x) => x.id === userId)
    return u?.name || u?.email || "Unknown"
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
      id: crypto.randomUUID(),
      type: "taskStatus",
      entity: "task",
      entity_id: taskId,
      // Denormalized scope: a task property's channel is the task's channel.
      // Without it the row syncs back to nobody but its creator.
      channel_id: channelId,
      task_status_value: next,
    })
  }

  function handleConfirm() {
    const trimmed = note.trim()
    if (!trimmed || !currentUserId || isSubmitting) return
    const next: "open" | "completed" = completed ? "open" : "completed"
    setIsSubmitting(true)
    try {
      // messages.text is varchar(500). The note is the part worth keeping, so the
      // task name is what gets truncated if the two together would overflow.
      const prefix = `Task ${next === "completed" ? "completed" : "reopened"}: `
      const suffix = ` — ${trimmed}`
      const room = 500 - prefix.length - suffix.length
      const name =
        taskName.length > room && room > 1
          ? `${taskName.slice(0, room - 1)}…`
          : taskName
      createMessageAction({
        id: crypto.randomUUID(),
        text: `${prefix}${name}${suffix}`.slice(0, 500),
        channel_id: channelId,
        buildunit_id: buildUnitId,
        project_id: projectId,
        createdby_id: currentUserId,
        // What makes this message findable from the task page rather than only
        // by scrolling the channel.
        task_id: taskId,
      })
      // Status flips only after the note is recorded, so a task can never end up
      // completed with no explanation in the channel.
      applyStatus(next)
      setNote("")
      setNoteOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-0 py-2">
        <span className="text-sm text-muted-foreground w-32 shrink-0">Status</span>

        <button
          onClick={() => setNoteOpen(true)}
          title={completed ? "Reopen this task" : "Mark this task completed"}
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
            completed
              ? "bg-green-50 text-green-700 hover:bg-green-100"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {completed ? (
            <CheckCircle2 className="w-3 h-3 shrink-0" />
          ) : (
            <Circle className="w-3 h-3 shrink-0" />
          )}
          {completed ? "Completed" : "Open"}
        </button>

        <span className="text-sm text-muted-foreground ml-2">
          {completed ? "Click to reopen" : "Click to complete"}
        </span>
      </div>

      {/* Status history */}
      <div className="flex gap-0 py-2">
        <span className="text-sm text-muted-foreground w-32 shrink-0 pt-0.5">
          Status History
        </span>
        <div className="flex-1 space-y-2">
          {history.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              No status changes yet. Notes appear here when the status is changed.
            </span>
          ) : (
            history.map((m) => (
              <div
                key={m.id as string}
                className="border border-gray-200 rounded px-3 py-2"
              >
                {/* Shown verbatim: it is the same message the channel shows, and
                    re-parsing our own wording back apart would be a data model
                    made of prose. */}
                <p className="text-sm text-foreground">{m.text as string}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {authorName(m.createdby_id as string)} ·{" "}
                  {formatDateTime(m.created_at as string)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {noteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setNoteOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-5 w-96 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {completed ? "Why are you reopening this?" : "What was done?"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Required. Posted to the channel so the team sees the reason.
              </p>
            </div>

            <textarea
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#ac7f5e]"
              rows={3}
              maxLength={400}
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                completed
                  ? "e.g. Rebar spacing is off, needs redoing"
                  : "e.g. Slab poured, cured 48h"
              }
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setNote("")
                  setNoteOpen(false)
                }}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:bg-gray-100 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!note.trim() || isSubmitting}
                className="px-3 py-1.5 text-sm font-medium bg-[#ac7f5e] text-white rounded hover:bg-secondary-hover disabled:opacity-50 transition-colors"
              >
                {isSubmitting
                  ? "Saving…"
                  : completed
                    ? "Reopen Task"
                    : "Mark Completed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
