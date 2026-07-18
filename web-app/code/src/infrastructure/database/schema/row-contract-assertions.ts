import type {
  ProjectRow,
  BuildUnitRow,
  ChannelRow,
  MembershipRow,
  TeamRow,
  TaskRow,
  MessageRow,
  ResourceRow,
  PropertyRow,
  SeenStateRow,
} from "@buildinlime/contracts"
import type { projectsTable, buildUnitsTable, channelsTable, membershipTable } from "./organization-tables"
import type { tasksTable, messagesTable, resourcesTable, propertiesTable, seenStateTable } from "./communication-tables"
import type { teamsTable } from "./admin-tables"

// Holds the Electric ROW CONTRACT (@buildinlime/contracts schemas/rows) to the
// tables it claims to describe.
//
// The clients validate CLIENT MUTATIONS against those shared schemas — not rows
// arriving from sync. `validateData` lives in @tanstack/db's collection/mutations
// module and is called from the insert/update paths; collection/sync.js, which
// writes what Electric delivers, never calls it. (Confirm by reading those two
// files, not by trusting this comment: an earlier version of it asserted the
// opposite and was wrong for a long time.)
//
// That still makes coverage load-bearing, for two reasons:
//
//   1. Zod STRIPS unknown keys, and mutations DO go through it. A column missing
//      here is therefore dropped from your own OPTIMISTIC row and reads back
//      `undefined` until the server's version syncs over the top — a flicker of
//      missing data on the writer's screen only, which is exactly the kind of bug
//      that gets dismissed as a rendering glitch.
//   2. A missing column is untyped everywhere. It is present at runtime on synced
//      rows, but invisible to every call site, so features quietly never use it.
//      Mobile's old hand-written copy lost properties.channel_id and
//      properties.createdby_id that way.
//
// The corollary is worth stating because it is easy to get backwards: a row
// schema is NOT a runtime guarantee about synced data. Its preprocess steps
// (coerceBool, unwrapJsonb) run as part of validation, so they do not run on sync
// either. Any coercion a synced row does get comes from ELECTRIC's parser, which
// is a different mechanism — see ARCHITECTURE.md §10.
//
// This file has no runtime output. Its only job is to fail `pnpm typecheck` when a
// migration adds a synced column and rows.ts was not updated to match, naming the
// column in the error. It is the row-side counterpart to the input-side guarantee
// described in ARCHITECTURE.md §12.4.
//
// NOTE: this asserts COVERAGE (every column is described), not that each column's
// zod type is right — the row schemas deliberately model the WIRE, which is not
// the Postgres type: timestamps arrive as `string | Date` depending on whether the
// row came from Electric or was rehydrated from the local SQLite store, and jsonb
// enums pass through a preprocess. Comparing value types directly would fight that
// on purpose.

/**
 * Resolves to `true` when TRow describes every column of TTable, and otherwise to
 * a tuple naming the offenders. Fed through Assert below, a drifted table reports
 * as: Type '["row schema is missing columns:", "channel_id"]' does not satisfy the
 * constraint 'true'.
 */
type ColumnsCovered<TTable, TRow> =
  Exclude<keyof TTable, keyof TRow> extends never
    ? true
    : [`row schema is missing columns:`, Exclude<keyof TTable, keyof TRow>]

/** The `extends true` constraint is what turns a drift into a compile error. */
type Assert<T extends true> = T

// Exported (and type-level, not const) so neither noUnusedLocals nor a bundler can
// quietly drop the very checks this file exists for.
export type ProjectRowCoversTable = Assert<ColumnsCovered<typeof projectsTable.$inferSelect, ProjectRow>>
export type BuildUnitRowCoversTable = Assert<ColumnsCovered<typeof buildUnitsTable.$inferSelect, BuildUnitRow>>
export type ChannelRowCoversTable = Assert<ColumnsCovered<typeof channelsTable.$inferSelect, ChannelRow>>
export type MembershipRowCoversTable = Assert<ColumnsCovered<typeof membershipTable.$inferSelect, MembershipRow>>
export type TeamRowCoversTable = Assert<ColumnsCovered<typeof teamsTable.$inferSelect, TeamRow>>
export type TaskRowCoversTable = Assert<ColumnsCovered<typeof tasksTable.$inferSelect, TaskRow>>
export type MessageRowCoversTable = Assert<ColumnsCovered<typeof messagesTable.$inferSelect, MessageRow>>
export type ResourceRowCoversTable = Assert<ColumnsCovered<typeof resourcesTable.$inferSelect, ResourceRow>>
export type PropertyRowCoversTable = Assert<ColumnsCovered<typeof propertiesTable.$inferSelect, PropertyRow>>
export type SeenStateRowCoversTable = Assert<ColumnsCovered<typeof seenStateTable.$inferSelect, SeenStateRow>>

// `users` is deliberately absent. Its drizzle table names the columns in camelCase
// JS (emailVerified, createdAt) over snake_case Postgres, and Electric streams the
// COLUMN names — so userRowSchema's keys correctly do NOT match this table's, and
// the assertion would be comparing the wrong two things. The reads table is absent
// too: seen_state superseded it and neither client syncs it any more.
