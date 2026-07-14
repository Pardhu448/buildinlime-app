import {
  pgTable,
  primaryKey,
  timestamp,
  varchar,
  text,
  boolean,
  bigint,
  jsonb,
} from "drizzle-orm/pg-core"
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
})

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

export const selectTaskSchema = createSelectSchema(tasksTable)
export const createTaskSchema = createInsertSchema(tasksTable).omit({
  opened_at: true,
  closed_at: true,
})
export const updateTaskSchema = createUpdateSchema(tasksTable)

export const selectMessageSchema = createSelectSchema(messagesTable).extend({
  parent_id: z.string().nullish(),
  task_id: z.string().nullish(),
})
export const createMessageSchema = createInsertSchema(messagesTable).omit({
  created_at: true,
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
})
export const createResourceSchema = createInsertSchema(resourcesTable).omit({
  uploaded_at: true,
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

export type Task = z.infer<typeof selectTaskSchema>
export type UpdateTask = z.infer<typeof updateTaskSchema>
export type Message = z.infer<typeof selectMessageSchema>
export type UpdateMessage = z.infer<typeof updateMessageSchema>
export type Resource = z.infer<typeof selectResourceSchema>
export type UpdateResource = z.infer<typeof updateResourceSchema>
export type Property = z.infer<typeof selectPropertySchema>
export type UpdateProperty = z.infer<typeof updatePropertySchema>
export type Read = z.infer<typeof selectReadSchema>
