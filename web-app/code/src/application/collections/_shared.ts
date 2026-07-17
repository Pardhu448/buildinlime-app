// Shared helpers used across Electric collection files. The framework-free common
// parts (shape retry, memberships error tracking, GC tiers, the wire coercions) and
// the collection factory itself live once in @buildinlime/sync-core; this file
// injects the web platform primitives and re-exports the result.
import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { persistedCollectionOptions } from "@tanstack/browser-db-sqlite-persistence"
import { makeShapeRetry, makeCollectionOptionsBuilder } from "@buildinlime/sync-core"
import type { CollectionSpec } from "@buildinlime/sync-core"

export { NEVER_GC, IDLE_GC_MS, coerceBool, unwrapJsonb } from "@buildinlime/sync-core"

// Web omits the dev retry log (mobile wires one — see makeShapeRetry). One instance
// per app, so the memberships-error flag stays a per-app singleton.
export const {
  retryOnError,
  retryOnMembershipsError,
  membershipsShapeErrored,
  clearMembershipsShapeError,
} = makeShapeRetry()

export const origin = typeof window !== `undefined`
  ? window.location.origin
  : `https://localhost:5173`

const parser = {
  timestamptz: (date: string) => new Date(date),
  // int8 (resources.file_size_bytes) arrives as a string, and Electric's DEFAULT
  // parser turns it into a BigInt. A BigInt cannot be JSON.stringify'd, and the
  // offline outbox persists each mutation's row as JSON — so deleting an attachment
  // died with "Do not know how to serialize a BigInt" before it ever reached the
  // server. Parse to a plain number instead: exact to 2^53, i.e. ~9 petabytes. This
  // also keeps the persisted OPFS rows JSON-serialisable.
  //
  // The zod preprocess on file_size_bytes does NOT cover this — schema validation
  // runs on client mutations, not on rows arriving from sync.
  int8: (v: string) => Number(v),
}

const buildCollectionOptions = makeCollectionOptionsBuilder({
  electricCollectionOptions,
  persistedCollectionOptions,
  baseUrl: origin,
  parser,
  // No fetchClient: browser fetch carries the session cookie on its own. Mobile has
  // to inject one — see its _shared.ts.
  retryOnError,
})

/**
 * Builds a persisted Electric collection with web's primitives baked in: the
 * OPFS/wa-sqlite persistence builder and the page origin.
 *
 * Each collection file passes only what genuinely differs per table — see
 * CollectionSpec in sync-core. schemaVersion is deliberately NOT a parameter: every
 * collection must share one, or the persistence adapter cache forks.
 *
 * The `as any` is the same one that used to sit at every collection site: the
 * builders' options types don't compose, and createCollection is what recovers a
 * properly typed Collection from it.
 */
export const defineCollection = (spec: CollectionSpec) =>
  createCollection(buildCollectionOptions(spec) as any)
