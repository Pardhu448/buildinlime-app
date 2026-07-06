import {
  pgTable,
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

export const PROPERTY_TYPES = ["priority", "status", "targetDate", "startDate", "pendingTask", "percent_complete", "label"] as const
export const ENTITY_TYPES = ["project", "buildUnit", "channel", "task"] as const
export const STATUS_VALUES = ["critical", "high", "medium", "low"] as const
export const PRIORITY_VALUES = ["notStarted", "inProgress", "onTrack", "atRisk", "backLog", "overBudget", "onHold", "completed", "cancelled"] as const

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
  status_value: jsonb(`status_value`).$type<typeof STATUS_VALUES[number]>(),
  priority_value: jsonb(`priority_value`).$type<typeof PRIORITY_VALUES[number]>(),
  target_date: text(`target_date`),
  start_date: text(`start_date`),
  pending_task: text(`pending_task`),
  label_value: text(`label_value`),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const selectTaskSchema = createSelectSchema(tasksTable)
export const createTaskSchema = createInsertSchema(tasksTable).omit({
  opened_at: true,
  closed_at: true,
})
export const updateTaskSchema = createUpdateSchema(tasksTable)

export const selectMessageSchema = createSelectSchema(messagesTable).extend({
  parent_id: z.string().nullish(),
})
export const createMessageSchema = createInsertSchema(messagesTable).omit({
  created_at: true,
}).extend({
  parent_id: z.string().nullish(),
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
  target_date: z.string().nullish(),
  start_date: z.string().nullish(),
  pending_task: z.string().nullish(),
  label_value: z.string().nullish(),
  channel_id: z.string().nullish(),
})
export const createPropertySchema = createInsertSchema(propertiesTable).omit({ created_at: true })
export const updatePropertySchema = createUpdateSchema(propertiesTable)

export type Task = z.infer<typeof selectTaskSchema>
export type UpdateTask = z.infer<typeof updateTaskSchema>
export type Message = z.infer<typeof selectMessageSchema>
export type UpdateMessage = z.infer<typeof updateMessageSchema>
export type Resource = z.infer<typeof selectResourceSchema>
export type UpdateResource = z.infer<typeof updateResourceSchema>
export type Property = z.infer<typeof selectPropertySchema>
export type UpdateProperty = z.infer<typeof updatePropertySchema>
