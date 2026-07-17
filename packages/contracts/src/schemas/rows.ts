import { z } from "zod"
import {
  CHANNEL_NAMES,
  MEMBERSHIP_ROLES,
  PROPERTY_TYPES,
  ENTITY_TYPES,
  STATUS_VALUES,
  PRIORITY_VALUES,
  TASK_STATUS_VALUES,
  SEEN_SCOPES,
} from "@buildinlime/domain-types"

// The ROW half of the wire contract: what an Electric shape delivers for each
// synced table, as pure zod both clients validate against.
//
// The sibling schemas in this directory describe what a client SENDS (tRPC
// inputs); these describe what the server STREAMS back. Both apps previously kept
// their own copy of this half — web derived it from drizzle via
// createSelectSchema, mobile hand-wrote the equivalent zod — with nothing tying
// the two together, so a column added server-side updated web mechanically and
// left mobile silently stale. See ARCHITECTURE.md §12.5.
//
// The server holds these to its tables in database/schema/*-tables.ts: each
// drizzle-derived select schema is asserted assignable to the row schema here, so
// a column that changes shape in Postgres fails `pnpm typecheck` rather than
// reaching a client. This file is therefore the one place to edit when a synced
// column is added — the assertion tells you if you forgot.
//
// WHY THIS MATTERS MORE THAN IT LOOKS: zod STRIPS unknown keys. A column missing
// from the object below is not merely untyped, it is DROPPED from the synced row
// and reads back `undefined` at every call site.

// --- Wire coercions ---------------------------------------------------------
//
// Electric's own parser already handles most of this (its defaultParser maps
// bool → parseBool and jsonb → parseJson). The preprocessors below cover the case
// it cannot: parseRow returns the value UNTOUCHED when the shape carries no
// column metadata for that key, leaving the raw Postgres text. They are no-ops on
// an already-parsed value, so applying them is free insurance rather than a
// second parse.

/** Electric returns boolean columns as the string "true"/"false". */
export const coerceBool = (v: unknown) => v === `true` || v === true

/** Electric returns jsonb columns as JSON-encoded strings (e.g. '"critical"'). */
export const unwrapJsonb = (v: unknown) =>
  typeof v === `string` && v.startsWith(`"`) ? JSON.parse(v) : v

/**
 * A timestamptz column as it can actually appear on a client.
 *
 * Both a `Date` (fresh off Electric, whose timestamptz parser constructs one) and
 * a `string` (rehydrated from the SQLite/OPFS persistence layer, where the Date
 * was serialised on the way in) are legal, so the row types are `string | Date`
 * and call sites must not assume a Date method is there.
 */
const wireTimestamp = z.union([z.string(), z.date()])

/** A text[] column. Electric delivers a real array once the shape types it. */
const wireTextArray = z.array(z.string())

const projectPriority = z.enum([`High`, `Mid`, `Low`])
const buildUnitHealth = z.enum([`On track`, `At risk`, `Off track`])

// --- users ------------------------------------------------------------------
//
// Hand-written rather than derived: the drizzle `users` table names its columns in
// camelCase JS (emailVerified, createdAt) over snake_case Postgres, and Electric
// streams the COLUMN names. So createSelectSchema(users) produces the wrong keys
// here and deliberately is not used.

export const userRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  email_verified: z.preprocess(coerceBool, z.boolean()).optional(),
  image: z.string().nullable().optional(),
  created_at: wireTimestamp.optional(),
  updated_at: wireTimestamp.optional(),
})

// --- organization -----------------------------------------------------------

export const projectRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  priority: z.preprocess(unwrapJsonb, projectPriority.nullish()),
  target_date: z.string().nullish(),
  status_percent: z.string().nullish(),
  owner_id: z.string(),
  created_at: wireTimestamp.optional(),
})

export const buildUnitRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  health: z.preprocess(unwrapJsonb, buildUnitHealth.nullish()),
  priority: z.preprocess(unwrapJsonb, projectPriority.nullish()),
  task_name: z.string().nullish(),
  task_assignee: z.string().nullish(),
  task_since: z.string().nullish(),
  target_date: z.string().nullish(),
  status_percent: z.string().nullish(),
  project_id: z.string(),
  owner_id: z.string(),
  created_at: wireTimestamp.optional(),
})

export const channelRowSchema = z.object({
  id: z.string(),
  name: z.preprocess(unwrapJsonb, z.enum(CHANNEL_NAMES)),
  description: z.string().nullish(),
  buildunit_id: z.string(),
  owner_id: z.string(),
  created_at: wireTimestamp.optional(),
})

/**
 * One schema for BOTH membership streams: the SELF stream (scoped `user_id = me`
 * server-side) and the ROSTER stream (every member of the visible channels). They
 * read the same `memberships` table through different where clauses.
 */
export const membershipRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  channel_id: z.string(),
  buildunit_id: z.string(),
  project_id: z.string(),
  member_flag: z.preprocess(coerceBool, z.boolean()),
  role: z.enum(MEMBERSHIP_ROLES).default(`viewer`),
  created_at: wireTimestamp.optional(),
})

// --- admin ------------------------------------------------------------------

export const teamRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  owner_id: z.string(),
  project_id: z.string(),
  member_ids: z.preprocess(
    (v) => (typeof v === `string` ? JSON.parse(v) : v),
    wireTextArray.default([]),
  ),
  created_at: wireTimestamp.optional(),
})

// --- communication ----------------------------------------------------------

/**
 * deleted_at / deleted_by_id are carried even though the tasks shape filters
 * soft-deleted rows out server-side (`deleted_at IS NULL`) — the columns exist, and
 * a schema that silently dropped them would be a trap if the filter ever relaxes.
 */
export const taskRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  completed: z.preprocess(coerceBool, z.boolean()),
  opened_at: wireTimestamp.optional(),
  closed_at: wireTimestamp.optional(),
  channel_id: z.string(),
  buildunit_id: z.string(),
  createdby_id: z.string(),
  assignee_id: z.string().nullish(),
  deleted_at: wireTimestamp.nullish(),
  deleted_by_id: z.string().nullish(),
})

/**
 * Unlike tasks and resources, messages are NOT filtered out of their shape when
 * deleted: a deleted message is redacted in place (text and the id arrays cleared)
 * because replies hang off it via parent_id. The tombstone columns below are what
 * the UI renders "This message was deleted" from — never the text.
 */
export const messageRowSchema = z.object({
  id: z.string(),
  text: z.string(),
  channel_id: z.string(),
  buildunit_id: z.string(),
  project_id: z.string(),
  createdby_id: z.string(),
  mention_ids: wireTextArray.nullish(),
  resource_ids: wireTextArray.nullish(),
  parent_id: z.string().nullish(),
  // Set only on task status-change notes — see Message.task_id.
  task_id: z.string().nullish(),
  deleted_at: wireTimestamp.nullish(),
  deleted_by_id: z.string().nullish(),
  created_at: wireTimestamp.optional(),
})

/**
 * file_size_bytes is int8. Electric's DEFAULT parser turns it into a BigInt, which
 * cannot be JSON.stringify'd — and the offline outbox persists each mutation's row
 * as JSON, so deleting an attachment died with "Do not know how to serialize a
 * BigInt" before it reached the server. Both apps override the int8 parser to
 * produce a plain number (exact to 2^53, ~9 petabytes); this preprocess is the
 * schema-side half of the same defence.
 */
export const resourceRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  file_location: z.string(),
  mime_type: z.string(),
  file_size_bytes: z.preprocess(
    (v) => (typeof v === `string` || typeof v === `bigint` ? Number(v) : v),
    z.number(),
  ),
  uploaded_at: wireTimestamp.optional(),
  message_id: z.string().nullish(),
  task_id: z.string().nullish(),
  channel_id: z.string(),
  buildunit_id: z.string(),
  project_id: z.string(),
  createdby_id: z.string(),
  deleted_at: wireTimestamp.nullish(),
  deleted_by_id: z.string().nullish(),
})

/**
 * channel_id is the denormalized channel scope (set for channel- and task-entity
 * properties, NULL for project/build-unit ones) that lets the properties shape sync
 * by channel instead of a per-task id snapshot; createdby_id is the owner escape
 * hatch in that shape. Mobile's hand-written copy omitted both, so zod stripped
 * them from every synced property row — latent rather than live only because no
 * mobile call site read them yet.
 */
export const propertyRowSchema = z.object({
  id: z.string(),
  type: z.preprocess(unwrapJsonb, z.enum(PROPERTY_TYPES)),
  entity: z.preprocess(unwrapJsonb, z.enum(ENTITY_TYPES)),
  entity_id: z.string(),
  channel_id: z.string().nullish(),
  createdby_id: z.string().nullish(),
  status_value: z.preprocess(unwrapJsonb, z.enum(STATUS_VALUES).nullish()),
  priority_value: z.preprocess(unwrapJsonb, z.enum(PRIORITY_VALUES).nullish()),
  task_status_value: z.preprocess(unwrapJsonb, z.enum(TASK_STATUS_VALUES).nullish()),
  target_date: z.string().nullish(),
  start_date: z.string().nullish(),
  pending_task: z.string().nullish(),
  // Own column as of migration 0003; it used to share `pending_task`.
  percent_complete: z.string().nullish(),
  label_value: z.string().nullish(),
  created_at: wireTimestamp.optional(),
})

/**
 * Per-user "last seen" markers — one row per (user, scope, scope_id). An item is
 * unseen iff it arrived after the marker for its view. The shape is scoped
 * `user_id = me`, so it takes no membership ids and never rebuilds on scope change.
 */
export const seenStateRowSchema = z.object({
  user_id: z.string(),
  scope: z.preprocess(unwrapJsonb, z.enum(SEEN_SCOPES)),
  scope_id: z.string().default(``),
  seen_at: wireTimestamp.optional(),
})

// --- inferred row types -----------------------------------------------------

export type UserRow = z.infer<typeof userRowSchema>
export type ProjectRow = z.infer<typeof projectRowSchema>
export type BuildUnitRow = z.infer<typeof buildUnitRowSchema>
export type ChannelRow = z.infer<typeof channelRowSchema>
export type MembershipRow = z.infer<typeof membershipRowSchema>
export type TeamRow = z.infer<typeof teamRowSchema>
export type TaskRow = z.infer<typeof taskRowSchema>
export type MessageRow = z.infer<typeof messageRowSchema>
export type ResourceRow = z.infer<typeof resourceRowSchema>
export type PropertyRow = z.infer<typeof propertyRowSchema>
export type SeenStateRow = z.infer<typeof seenStateRowSchema>
