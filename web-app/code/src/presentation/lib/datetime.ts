/**
 * Absolute date + time for message, resource and task timestamps —
 * "13 Jul, 09:17". Mirrors mobile's formatDateTime
 * (mobile-app/src/presentation/shared/lib/datetime.ts) so the two apps read the
 * same; keep them in step.
 *
 * Deliberately absolute rather than relative ("3d ago"): these are build records,
 * and when a decision was made or a document landed is often the point of reading
 * them. The year is dropped for the current year to keep rows short.
 */
export function formatDateTime(date: Date | string | undefined | null): string {
  if (!date) return ""
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return ""

  const day = d.getDate().toString().padStart(2, "0")
  const month = d.toLocaleString(undefined, { month: "short" })
  const time = `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`

  const showYear = d.getFullYear() !== new Date().getFullYear()

  return showYear
    ? `${day} ${month} ${d.getFullYear()}, ${time}`
    : `${day} ${month}, ${time}`
}
