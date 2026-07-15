import {
  pgTable,
  primaryKey,
  uniqueIndex,
  timestamp,
  varchar,
  text,
  boolean,
  bigint,
  jsonb,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"
import { users } from "./auth-schema"
import { channelsTable, buildUnitsTable, projectsTable } from "./organization-tables"

const { createInsertSchema, createSelectSchema, createUpdateSchema } =
  createSchemaFactory({ zodInstance: z })

export const tasksTable = pgTable(`tasks`, {
  id: text(`id`).primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  description: varchar({ length: 500 }).notNull(),
  completed: boolean().notNull().default(false),
  opened_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  closed_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  channel_id: text(`channel_id`)
    .notNull()
    .references(() => channelsTable.id, { onDelete: `cascade` }),
  buildunit_id: text(`buildunit_id`)
    .notNull()
    .references(() => buildUnitsTable.id, { onDelete: `cascade` }),
  createdby_id: text(`createdby_id`)
    .notNull()
    .references(() => users.id, { onDelete: `cascade` }),
  assignee_id: text(`assignee_id`)
    .references(() => users.id, { onDelete: `set null` }),
  // Soft delete. Nothing hangs off a task the way replies hang off a message, so a
  // deleted task is filtered OUT of the Electric shape (`deleted_at IS NULL`) and
  // vanishes for every client — no UI filtering to remember at each call site.
  deleted_at: timestamp({ withTimezone: true }),
  deleted_by_id: text(`deleted_by_id`)
    .references(() => users.id, { onDelete: `set null` }),
}, (t) => [
  // A task name must be unique within its channel. This is not a nicety: the WEB
  // ROUTE IS THE NAME (/…/$channelName/$taskName, resolved by
  // `find(t => t.name === taskName)` in use-task-route). Two tasks sharing a name
  // meant one of them was simply unreachable on web, and which one depended on
  // collection iteration order.
  //
  // lower(name) so "Site Survey" and "site survey" collide — two tasks a human
  // cannot tell apart should not be allowed to coexist either.
  //
  // PARTIAL on deleted_at IS NULL: a deleted task must RELEASE its name. Without the
  // predicate a soft-deleted task would keep occupying it forever, and recreating a
  // task you just deleted would fail against a row nobody can even see.
  uniqueIndex(`tasks_channel_name_unique`)
    .on(t.channel_id, sql`lower(${t.name})`)
    .where(sql`${t.deleted_at} IS NULL`),
])

export const messagesTable = pgTable(`messages`, {
  id: text(`id`).primaryKey(),
  text: varchar({ length: 500 }).notNull(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  channel_id: text(`channel_id`)
    .notNull()
    .references(() => channelsTable.id, { onDelete: `cascade` }),
  buildunit_id: text(`buildunit_id`)
    .notNull()
    .references(() => buildUnitsTable.id, { onDelete: `cascade` }),
  project_id: text(`project_id`)
    .notNull()
    .references(() => projectsTable.id, { onDelete: `cascade` }),
  createdby_id: text(`createdby_id`)
    .notNull()
    .references(() => users.id, { onDelete: `cascade` }),
  mention_ids: text('mention_ids').array().notNull(),
  resource_ids: text('resource_ids').array().notNull(),
  parent_id: text(`parent_id`)
    .references((): any => messagesTable.id, { onDelete: `set null` }),
  // The task this message is about, when it is about one. Set on the note that
  // accompanies a task status change, so the task screen can show its own history
  // without a task_notes table — the message stays an ordinary channel message and
  // is simply also addressable by task.
  //
  // `set null`, NOT `cascade`: deleting a task must not silently delete messages
  // out of the channel feed. The message survives, it just loses the task link.
  task_id: text(`task_id`)
    .references(() => tasksTable.id, { onDelete: `set null` }),
  // Soft delete. A deleted message is REDACTED IN PLACE, not removed: the row must
  // survive because replies hang off it via parent_id, and dropping it would orphan
  // a whole thread. So the server clears text / mention_ids / resource_ids and
  // stamps these — what syncs to every device is an empty tombstone, not the words.
  //
  // This is why messages, unlike tasks and resources, are NOT filtered out of their
  // Electric shape: the client needs the row to render "This message was deleted".
  deleted_at: timestamp({ withTimezone: true }),
  deleted_by_id: text(`deleted_by_id`)
    .references(() => users.id, { onDelete: `set null` }),
})

export const resourcesTable = pgTable(`resources`, {
  id: text(`id`).primaryKey(),
  name: varchar(`name`, { length: 255 }).notNull(),
  description: text(`description`),
  file_location: text(`file_location`).notNull(),
  mime_type: varchar(`mime_type`, { length: 100 }).notNull(),
  file_size_bytes: bigint(`file_size_bytes`, { mode: 'number' }).notNull(),
  uploaded_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  message_id: text(`message_id`)
    .references(() => messagesTable.id, { onDelete: `cascade` }),
  task_id: text(`task_id`)
    .references(() => tasksTable.id, { onDelete: `set null` }),
  channel_id: text(`channel_id`)
    .notNull()
    .references(() => channelsTable.id, { onDelete: `cascade` }),
  buildunit_id: text(`buildunit_id`)
    .notNull()
    .references(() => buildUnitsTable.id, { onDelete: `cascade` }),
  project_id: text(`project_id`)
    .notNull()
    .references(() => projectsTable.id, { onDelete: `cascade` }),
  createdby_id: text(`createdby_id`)
    .notNull()
    .references(() => users.id, { onDelete: `cascade` }),
  // Soft delete. Unlike a message, nothing hangs off a resource, so a deleted one
  // is filtered OUT of the Electric shape entirely (`deleted_at IS NULL`) and simply
  // ceases to exist for every client. The FILE ON DISK is not reclaimed — resources_raw
  // still holds its path. Purging bytes is a separate job.
  deleted_at: timestamp({ withTimezone: true }),
  deleted_by_id: text(`deleted_by_id`)
    .references(() => users.id, { onDelete: `set null` }),
})

// Server-only table — not synced via Electric.
// Holds the actual filesystem path and raw upload metadata.
export const resourcesRawTable = pgTable(`resources_raw`, {
  id: text(`id`).primaryKey(),
  resource_id: text(`resource_id`)
    .notNull()
    .references(() => resourcesTable.id, { onDelete: `cascade` }),
  storage_path: text(`storage_path`).notNull(),
  original_filename: text(`original_filename`).notNull(),
  mime_type: varchar(`mime_type`, { length: 100 }).notNull(),
  file_size_bytes: bigint(`file_size_bytes`, { mode: 'number' }).notNull(),
  uploaded_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const PROPERTY_TYPES = ["priority", "status", "targetDate", "startDate", "pendingTask", "percent_complete", "label", "taskStatus"] as const
export const ENTITY_TYPES = ["project", "buildUnit", "channel", "task"] as const
export const STATUS_VALUES = ["critical", "high", "medium", "low"] as const
export const PRIORITY_VALUES = ["notStarted", "inProgress", "onTrack", "atRisk", "backLog", "overBudget", "onHold", "completed", "cancelled"] as const
// Whether a task is done. Only meaningful on entity "task", and the source of
// truth for `tasks.completed` — the properties router writes the column through
// in the same transaction, so the two can never drift.
export const TASK_STATUS_VALUES = ["open", "completed"] as const

export const propertiesTable = pgTable(`properties`, {
  id: text(`id`).primaryKey(),
  type: jsonb(`type`).$type<typeof PROPERTY_TYPES[number]>().notNull(),
  entity: jsonb(`entity`).$type<typeof ENTITY_TYPES[number]>().notNull(),
  entity_id: text(`entity_id`).notNull(),
  // Denormalized channel scope. Set for channel- and task-entity properties
  // (channel_id = the channel itself, or the task's channel); NULL for
  // project/build-unit properties. Lets the properties shape sync channel and
  // task properties by channel_id — the same scope as tasks/messages — instead
  // of a per-task id snapshot, so a new task's properties in a visible channel
  // are covered with no collection rebuild.
  channel_id: text(`channel_id`).references(() => channelsTable.id, { onDelete: `cascade` }),
  // The user who created the property. Acts as an owner escape hatch in the
  // properties shape (OR createdby_id = me), so properties on an entity you own
  // but that has no membership yet — e.g. a build-unit/project with no channel —
  // still sync. Mirrors the `owner_id = me` clause on the entity shapes.
  createdby_id: text(`createdby_id`).references(() => users.id, { onDelete: `cascade` }),
  status_value: jsonb(`status_value`).$type<typeof STATUS_VALUES[number]>(),
  priority_value: jsonb(`priority_value`).$type<typeof PRIORITY_VALUES[number]>(),
  task_status_value: jsonb(`task_status_value`).$type<typeof TASK_STATUS_VALUES[number]>(),
  target_date: text(`target_date`),
  start_date: text(`start_date`),
  pending_task: text(`pending_task`),
  // percent_complete used to share the `pending_task` column with the
  // pendingTask type — two property types writing one column. It has its own
  // column now; the migration backfills the existing rows across.
  percent_complete: text(`percent_complete`),
  label_value: text(`label_value`),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

/**
 * Per-user read state for messages and tasks — one row per item the user has
 * seen. Deliberately its own table rather than a `read_by` column on messages:
 * a column on the shared message row would dirty a row that every channel member
 * syncs, whereas these rows are private (the Electric shape is scoped
 * `user_id = me`), so marking read fans out to nobody.
 *
 * Absence of a row means unread — no backfill needed for existing content.
 */
export const READ_ITEM_TYPES = ["message", "task"] as const

export const readsTable = pgTable(
  `reads`,
  {
    user_id: text(`user_id`)
      .notNull()
      .references(() => users.id, { onDelete: `cascade` }),
    item_type: jsonb(`item_type`).$type<typeof READ_ITEM_TYPES[number]>().notNull(),
    item_id: text(`item_id`).notNull(),
    // Denormalized channel scope, same trick the properties table uses: lets the
    // shape sync a user's reads by the channels they can see, with no per-item
    // id snapshot to rebuild when a message or task is created.
    channel_id: text(`channel_id`)
      .notNull()
      .references(() => channelsTable.id, { onDelete: `cascade` }),
    read_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.item_type, t.item_id] })],
)

/**
 * Per-user "last seen" markers — the timestamp successor to the per-item `reads`
 * table (which stays for now because mobile still uses it; web has cut over to
 * this). Instead of one row per item read, one row per VIEW marks when the user
 * last looked at it: opening a view marks everything currently in it seen, and an
 * item is "unseen" iff it arrived after that timestamp. Chronological, not
 * per-item — see the seen hooks on the client.
 *
 * scope + scope_id:
 *   - ('inbox', '')        → the Inbox mentions view (one per user)
 *   - ('mytasks', '')      → the My-Tasks view (one per user)
 *   - ('channel', chanId)  → one per channel the user has opened
 * scope_id is '' (not null) for the singleton scopes so the composite PK and the
 * client key stay simple. No FK on scope_id: it is '' for the singletons, so it
 * cannot reference channels; an orphaned channel row after a channel delete is
 * harmless.
 *
 * The shape is scoped `user_id = me` (see routes/api/seen-state.ts) — purely
 * user-owned, like reads, so it needs no membership params and never rebuilds on
 * scope change.
 */
export const SEEN_SCOPES = ["inbox", "mytasks", "channel"] as const
export type SeenScope = typeof SEEN_SCOPES[number]

export const seenStateTable = pgTable(
  `seen_state`,
  {
    user_id: text(`user_id`)
      .notNull()
      .references(() => users.id, { onDelete: `cascade` }),
    scope: jsonb(`scope`).$type<SeenScope>().notNull(),
    scope_id: text(`scope_id`).notNull().default(``),
    seen_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.scope, t.scope_id] })],
)

// deleted_at / deleted_by_id are omitted from every insert schema: soft-deletion is
// the server's to stamp (routers/*.ts), never something a client may assert on the
// way in. Otherwise a client could create a row that is already deleted.
//
// They are also NULLISH in every SELECT schema, and that is not cosmetic. The
// select schemas double as the CLIENT-SIDE validators on the Electric collections,
// and the collections are also where optimistic rows are inserted. drizzle-zod
// renders a nullable column as .nullable() — present-but-null, i.e. still a
// REQUIRED key — so a plain createSelectSchema() makes deleted_at mandatory on
// every optimistic insert. createTaskAction doesn't send it (it has no business
// asserting deletion state), so tasksCollection.insert() threw and "New task"
// silently did nothing. .nullish() lets the key be absent on the way in while
// still accepting the null that every synced row carries.
export const selectTaskSchema = createSelectSchema(tasksTable).extend({
  deleted_at: z.coerce.date().nullish(),
  deleted_by_id: z.string().nullish(),
})
export const createTaskSchema = createInsertSchema(tasksTable).omit({
  opened_at: true,
  closed_at: true,
  deleted_at: true,
  deleted_by_id: true,
})
export const updateTaskSchema = createUpdateSchema(tasksTable)

export const selectMessageSchema = createSelectSchema(messagesTable).extend({
  parent_id: z.string().nullish(),
  task_id: z.string().nullish(),
  deleted_at: z.coerce.date().nullish(),
  deleted_by_id: z.string().nullish(),
})
export const createMessageSchema = createInsertSchema(messagesTable).omit({
  created_at: true,
  deleted_at: true,
  deleted_by_id: true,
}).extend({
  parent_id: z.string().nullish(),
  task_id: z.string().nullish(),
  // Accept the client's optimistic send time. Without it, offline-transactions
  // replay stamps the row with the (much later) server insert time, so a
  // message jumps position when it transitions optimistic→synced. Optional —
  // falls back to the column's defaultNow() when the client omits it.
  created_at: z.coerce.date().optional(),
})
export const updateMessageSchema = createUpdateSchema(messagesTable)

export const selectResourceSchema = createSelectSchema(resourcesTable).extend({
  description: z.string().nullish(),
  message_id: z.string().nullish(),
  task_id: z.string().nullish(),
  file_size_bytes: z.number(),
  // Nullish for the same reason as tasks above — a required deleted_at would
  // reject any optimistic row built client-side.
  deleted_at: z.coerce.date().nullish(),
  deleted_by_id: z.string().nullish(),
})
export const createResourceSchema = createInsertSchema(resourcesTable).omit({
  uploaded_at: true,
  deleted_at: true,
  deleted_by_id: true,
})
export const updateResourceSchema = createUpdateSchema(resourcesTable)

export const selectPropertySchema = createSelectSchema(propertiesTable).extend({
  type: z.enum(PROPERTY_TYPES),
  entity: z.enum(ENTITY_TYPES),
  status_value: z.enum(STATUS_VALUES).nullish(),
  priority_value: z.enum(PRIORITY_VALUES).nullish(),
  task_status_value: z.enum(TASK_STATUS_VALUES).nullish(),
  target_date: z.string().nullish(),
  start_date: z.string().nullish(),
  pending_task: z.string().nullish(),
  percent_complete: z.string().nullish(),
  label_value: z.string().nullish(),
  channel_id: z.string().nullish(),
  createdby_id: z.string().nullish(),
})
export const createPropertySchema = createInsertSchema(propertiesTable).omit({ created_at: true })
export const updatePropertySchema = createUpdateSchema(propertiesTable)

export const selectReadSchema = createSelectSchema(readsTable).extend({
  item_type: z.enum(READ_ITEM_TYPES),
})
export const createReadSchema = createInsertSchema(readsTable).omit({ read_at: true })

export const selectSeenStateSchema = createSelectSchema(seenStateTable).extend({
  scope: z.enum(SEEN_SCOPES),
})
export const createSeenStateSchema = createInsertSchema(seenStateTable).omit({ seen_at: true })

export type Task = z.infer<typeof selectTaskSchema>
export type UpdateTask = z.infer<typeof updateTaskSchema>
export type Message = z.infer<typeof selectMessageSchema>
export type UpdateMessage = z.infer<typeof updateMessageSchema>
export type Resource = z.infer<typeof selectResourceSchema>
export type UpdateResource = z.infer<typeof updateResourceSchema>
export type Property = z.infer<typeof selectPropertySchema>
export type UpdateProperty = z.infer<typeof updatePropertySchema>
export type Read = z.infer<typeof selectReadSchema>
