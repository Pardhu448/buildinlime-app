// Shared helpers used across Electric collection files. The framework-free common
// parts (shape retry, memberships error tracking, GC tiers, coerceBool) live once
// in @buildinlime/sync-core; this file re-exports them and adds the mobile-only bits.
import { makeShapeRetry } from "@buildinlime/sync-core"
import { createCookieFetch } from "../../infrastructure/auth/cookie-fetch"

export { NEVER_GC, IDLE_GC_MS, coerceBool } from "@buildinlime/sync-core"

export const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"
export const cookieFetch = createCookieFetch()

// Mobile logs a retry line in dev — a repeating line is the only outward sign a
// shape is stuck retrying. One instance per app, so the memberships-error flag
// stays a per-app singleton.
export const {
  retryOnError,
  retryOnMembershipsError,
  membershipsShapeErrored,
  clearMembershipsShapeError,
} = makeShapeRetry((message) => {
  if (__DEV__) console.log(message)
})

// Stop an Electric collection's sync and release its shape + SQLite handles.
// Callers MUST cleanup() the previous instance before replacing it (project
// switch, resync) or on teardown (reset) — otherwise its long-poll leaks. Guarded
// so a double-cleanup or a never-synced/null collection can't throw.
export function safeCleanup(
  collection: { cleanup?: () => unknown } | null | undefined,
): void {
  try {
    collection?.cleanup?.()
  } catch {
    // best-effort — the instance is being discarded anyway
  }
}

export const unwrapJsonb = (v: unknown) =>
  typeof v === "string" && v.startsWith('"') ? JSON.parse(v) : v

// Hermes (React Native) cannot parse PostgreSQL's timestamp format
// "2024-01-15 10:30:00.123456+00" — it needs strict ISO 8601 with 'T' separator.
const normalizeTs = (d: string) =>
  d.replace(" ", "T").replace(/\+00(?::00)?$/, "Z")

export const parser = {
  timestamptz: (d: string) => new Date(normalizeTs(d)),
  // int8 (resources.file_size_bytes) arrives as a string, and Electric's DEFAULT
  // parser turns it into a BigInt. A BigInt cannot be JSON.stringify'd, and the
  // offline outbox persists each mutation's row as JSON — so deleting an attachment
  // died with "Do not know how to serialize a BigInt" before it ever reached the
  // server. Parse to a plain number instead: exact to 2^53, i.e. ~9 petabytes.
  //
  // The zod preprocess on file_size_bytes does NOT cover this — schema validation
  // runs on client mutations, not on rows arriving from sync.
  int8: (v: string) => Number(v),
}
