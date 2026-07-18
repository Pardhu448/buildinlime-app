/**
 * Composes the channel message that records a task status change.
 *
 * A status change is recorded as an ordinary channel message carrying the task's
 * id — tasks have no notes table, so this is a record in the channel rather than
 * a history on the task. Zero schema change, and the team sees the reason in
 * context.
 *
 * messages.text is varchar(500). The note is the part worth keeping, so the task
 * NAME is what gets truncated if the two together would overflow.
 *
 * `note` is expected already trimmed; the caller rejects an empty one.
 */
export function buildStatusNoteText({
  taskName,
  next,
  note,
}: {
  taskName: string
  next: "open" | "completed"
  note: string
}): string {
  const label = next === "completed" ? `completed` : `reopened`
  const prefix = `Task ${label}: `
  const suffix = ` — ${note}`
  const room = 500 - prefix.length - suffix.length
  const name =
    taskName.length > room && room > 1 ? `${taskName.slice(0, room - 1)}…` : taskName
  return `${prefix}${name}${suffix}`.slice(0, 500)
}
