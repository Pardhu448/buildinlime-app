// Pending-upload POLICY — the rules both apps' upload paths obey, in one copy.
//
// Scope note, because it is easy to expect more from this file than it gives:
// this is the policy layer ONLY. The two upload implementations around it
// (web's usePendingResources hook, mobile's upload-manager service) are NOT
// unified and deliberately so — they differ in ways that are design, not drift:
//
//   - lifetime      web is per-hook-instance state; mobile is a module singleton
//                   that must outlive screen unmounts
//   - data model    web carries a File + objectUrl (+ description, memberIds);
//                   mobile carries a uri + mimeType for a file copied to disk
//   - interruption  on restore web RESETS an interrupted `uploading` to
//                   `awaiting_schedule` and waits for the user; mobile RESUMES
//                   it (that is what its `inFlight` set exists to permit)
//
// What genuinely was duplicated is below: the status vocabulary, the backoff
// numbers, and the three decisions. Those had drifted into two copies of the
// same literals, which is precisely the kind of thing that silently stops
// matching. Behaviour is unchanged on both sides — every function here returns
// what the inlined code it replaced already returned.

export type UploadStatus =
  | "awaiting_schedule"
  | "scheduled"
  | "uploading"
  | "awaiting_network"
  | "error"
  // Terminal success. The POST landed, but the pending row is KEPT (showing its
  // local file) as the optimistic stand-in until the synced `resources` row of
  // the same id arrives in the collection — only then is it purged. Dropping the
  // local file the instant the POST returns guarantees at least a brief blank
  // while the row makes its way back through Electric; this bridges that gap.
  // Never retried, never re-driven on hydration.
  //
  // The long blanking that motivated this (attachment gone until a reload) was
  // the sync freeze of DISAPPEARING_MESSAGES_INVESTIGATION.md §11, now fixed —
  // with healthy sync the gap is sub-second. Kept as ordinary optimistic UI, and
  // because it degrades gracefully if sync ever stalls again.
  | "synced"

/** Auto-retry attempts before an upload is left for the user to retry by hand. */
export const MAX_AUTO_RETRIES = 5

/** Backoff ceiling — reached at attempt 6, so in practice the last attempt. */
export const MAX_BACKOFF_MS = 30_000

/**
 * Exponential backoff for a failed attempt: 1s, 2s, 4s, 8s, 16s, then capped.
 * `attempt` is 1-based (the first retry is attempt 1).
 */
export function nextRetryDelay(attempt: number): number {
  return Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (attempt - 1))
}

/**
 * Whether to arm a backoff timer after a failure.
 *
 * Offline never schedules one: the reconnect listener is what wakes those
 * uploads, so a timer would fire pointlessly into an offline network.
 */
export function shouldAutoRetry(attempt: number, online: boolean): boolean {
  return attempt <= MAX_AUTO_RETRIES && online
}

/**
 * How a failure is shown. Offline is not really a failure — it gets the calmer
 * "awaiting network" rather than a red error for something we will auto-retry.
 */
export function statusForFailure(online: boolean): UploadStatus {
  return online ? "error" : "awaiting_network"
}

/** Statuses the reconnect listener and hydration should re-drive. */
export function isRetryableStatus(status: UploadStatus): boolean {
  return status === "error" || status === "awaiting_network"
}

export type ScheduleDecision =
  | { kind: "now" }
  | { kind: "later"; delayMs: number }

/**
 * Whether a scheduled upload fires now or waits.
 *
 * A null time means "no schedule — go now", and a time already past also goes
 * now rather than arming a negative timeout.
 */
export function scheduleDecision(when: Date | null): ScheduleDecision {
  if (!when) return { kind: "now" }
  const delayMs = when.getTime() - Date.now()
  return delayMs <= 0 ? { kind: "now" } : { kind: "later", delayMs }
}
