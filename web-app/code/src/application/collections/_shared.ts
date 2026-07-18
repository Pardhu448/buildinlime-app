// Shared helpers used across Electric collection files. The framework-free common
// parts (shape retry, memberships error tracking, GC tiers, the wire coercions) and
// the collection factory itself live once in @buildinlime/sync-core; this file
// injects the web platform primitives and re-exports the result.
import { createCollection } from "@tanstack/react-db"
import type { Collection } from "@tanstack/react-db"
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
/**
 * Builds a persisted Electric collection with web's primitives baked in, and
 * states its ROW TYPE.
 *
 * The row type has to be supplied by the caller — inference cannot reach it.
 * sync-core types the injected tanstack builders as `(config: never) => object`
 * deliberately, so web and mobile can inject different persistence packages, and
 * `buildCollectionOptions` therefore returns a bare `object`. (Note also that
 * `createCollection`'s first type parameter is the SCHEMA, not the row — passing
 * a row type there yields a garbage row type rather than an error, which is a
 * genuinely easy mistake to make.) Asserting the result is the lever the app side
 * has, and it is what gives every useLiveQuery consumer real fields instead of
 * `unknown`.
 *
 * TRow must match the spec's schema. Both come from @buildinlime/contracts, so
 * they agree by construction — but the assertion does not verify it, so pass the
 * Row type that pairs with the schema the spec names.
 */
export const defineCollection = <TRow extends object>(spec: CollectionSpec) =>
  createCollection(buildCollectionOptions(spec) as any) as unknown as Collection<TRow, string>
