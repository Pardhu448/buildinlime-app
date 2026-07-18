// Shared helpers used across Electric collection files. The framework-free common
// parts (shape retry, memberships error tracking, GC tiers, the wire coercions) and
// the collection factory itself live once in @buildinlime/sync-core; this file
// injects the mobile platform primitives and re-exports the result.
import { createCollection } from "@tanstack/react-db"
import type { Collection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { persistedCollectionOptions } from "@tanstack/expo-db-sqlite-persistence"
import { makeShapeRetry, makeCollectionOptionsBuilder } from "@buildinlime/sync-core"
import type { CollectionSpec } from "@buildinlime/sync-core"
import { createCookieFetch } from "../../infrastructure/auth/cookie-fetch"

export { NEVER_GC, IDLE_GC_MS, coerceBool, unwrapJsonb } from "@buildinlime/sync-core"

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

const buildCollectionOptions = makeCollectionOptionsBuilder({
  electricCollectionOptions,
  persistedCollectionOptions,
  baseUrl: apiUrl,
  parser,
  fetchClient: cookieFetch,
  retryOnError,
})

/**
 * Builds a persisted Electric collection with mobile's primitives baked in: the
 * expo-sqlite persistence builder, the LAN/emulator API host, the Hermes-safe
 * parser, and the cookie-jar fetch RN's own fetch does not provide.
 *
 * Each collection file passes only what genuinely differs per table — see
 * CollectionSpec in sync-core. schemaVersion is deliberately NOT a parameter: every
 * collection must share one, or the persistence adapter cache forks.
 *
 * The `as any` is the same one that used to sit at every collection site: the
 * builders' options types don't compose, so the row type has to be stated by the
 * caller rather than inferred: sync-core types the injected tanstack builders as
 * `(config: never) => object` on purpose (web and mobile inject different
 * persistence packages), so buildCollectionOptions returns a bare `object` and
 * there is nothing left to infer from. Note also that createCollection's FIRST
 * type parameter is the schema, not the row — passing a row type there yields a
 * garbage row type rather than an error. Mirrors web's _shared.ts.
 *
 * TRow must match the spec's schema; both come from @buildinlime/contracts, so
 * they agree by construction, but the assertion does not verify it.
 */
export const defineCollection = <TRow extends object>(spec: CollectionSpec) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createCollection(buildCollectionOptions(spec) as any) as unknown as Collection<TRow, string>
