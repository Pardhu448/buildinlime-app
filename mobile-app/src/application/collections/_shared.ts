import { createCookieFetch } from "../../infrastructure/auth/cookie-fetch"

export const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"
export const cookieFetch = createCookieFetch()

// Disable TanStack DB garbage collection on these Electric collections.
//
// GC (default gcTime 5 min) fires when a collection has no mounted live query,
// and its cleanup ABORTS the Electric shape's long-poll (electric-db-collection
// aborts the fetch on cleanup). Because the app starts sync imperatively once
// via startSyncImmediate() and never restarts it, a GC'd collection goes
// permanently silent — no inbound sync, and optimistic writes are dropped on
// commit with nothing to redeliver them. On mobile the drawer/leaf-screen
// navigation routinely leaves collections with zero subscribers, so this bites
// (the web app dodges it only because a persistent sidebar keeps them
// subscribed). These collections are session-scoped and torn down explicitly
// (cleanup on project switch / reset), so GC is both redundant and harmful.
// A non-finite gcTime makes startGCTimer() skip scheduling (see @tanstack/db).
export const NEVER_GC = Infinity

// Stop an Electric collection's sync and release its shape + SQLite handles.
// With GC disabled (NEVER_GC), nothing auto-stops an orphaned collection, so
// callers MUST cleanup() the previous instance before replacing it (project
// switch, resync) or on teardown (reset) — otherwise its long-poll leaks.
// Guarded so a double-cleanup or a never-synced/null collection can't throw.
export function safeCleanup(
  collection: { cleanup?: () => unknown } | null | undefined,
): void {
  try {
    collection?.cleanup?.()
  } catch {
    // best-effort — the instance is being discarded anyway
  }
}

export const retryOnError = async (error: Error) => {
  // TEMP DEBUG (sync-stall investigation): surface shape errors that trigger a
  // retry — a repeating line here means a shape is stuck retrying and never
  // advancing. Remove once resolved.
  if (__DEV__) console.log(`[shape-retry] ${error?.message ?? String(error)}`)
  const delay = error.message.includes("401") ? 2000 : 5000
  await new Promise((resolve) => setTimeout(resolve, delay))
}

export const coerceBool = (v: unknown) => v === "true" || v === true
export const unwrapJsonb = (v: unknown) =>
  typeof v === "string" && v.startsWith('"') ? JSON.parse(v) : v

// Hermes (React Native) cannot parse PostgreSQL's timestamp format
// "2024-01-15 10:30:00.123456+00" — it needs strict ISO 8601 with 'T' separator.
const normalizeTs = (d: string) =>
  d.replace(" ", "T").replace(/\+00(?::00)?$/, "Z")

export const parser = {
  timestamptz: (d: string) => new Date(normalizeTs(d)),
}
