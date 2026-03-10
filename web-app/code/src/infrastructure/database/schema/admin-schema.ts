import {
  boolean,
  pgTable,
  timestamp,
  varchar,
  text,
  jsonb,
  bigint,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"
export * from "./auth-schema"
import { users } from "./auth-schema"

const { createInsertSchema, createSelectSchema, createUpdateSchema } =
  createSchemaFactory({ zodInstance: z })

export const projectsTable = pgTable(`projects`, {
  id: text('id').primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  description: text(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  priority: jsonb(`priority`).$type<"High" | "Mid" | "Low">(),
  target_date: varchar({ length: 100 }),
  owner_id: text(`owner_id`)
    .notNull()
    .references(() => users.id, { onDelete: `cascade` }),
  status_percent: varchar({ length: 10 }),
})

export const teamsTable = pgTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const buildUnitsTable = pgTable(`build_units`, {
  id: text(`id`).primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  description: text(),
  health: jsonb(`health`).$type<"On track" | "At risk" | "Off track">(),
  priority: jsonb(`priority`).$type<"High" | "Mid" | "Low">(),
  task_name: varchar({ length: 255 }),
  task_assignee: varchar({ length: 255 }),
  task_since: varchar({ length: 100 }),
  target_date: varchar({ length: 100 }),
  status_percent: varchar({ length: 10 }),
  project_id: text(`project_id`)
    .notNull()
    .references(() => projectsTable.id, { onDelete: `cascade` }),
  owner_id: text(`owner_id`)
    .notNull()
    .references(() => users.id, { onDelete: `cascade` }),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const channelsTable = pgTable(`channels`, {
  id: text(`id`).primaryKey(),
  name: jsonb(`name`).$type<"Finance" | "Requirements" | "Design" | "Materials" | "Tools" | "Execution" | "Experimentation">().notNull(),
  description: text(),
  buildunit_id: text(`buildunit_id`)
    .notNull()
    .references(() => buildUnitsTable.id, { onDelete: `cascade` }),
  owner_id: text(`owner_id`)
    .notNull()
    .references(() => users.id, { onDelete: `cascade` }),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const membershipTable = pgTable(`memberships`, {
  id: text(`id`).primaryKey(),
  user_id: text(`user_id`).notNull().references(() => users.id, { onDelete: `cascade` }),
  channel_id: text(`channel_id`).notNull().references(() => channelsTable.id, { onDelete: `cascade` }),
  buildunit_id: text(`buildunit_id`).notNull().references(() => buildUnitsTable.id, { onDelete: `cascade` }),
  project_id: text(`project_id`).notNull().references(() => projectsTable.id, { onDelete: `cascade` }),
  member_flag: boolean(`member_flag`).notNull().default(true),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex(`memberships_user_channel_unique`).on(t.user_id, t.channel_id)])

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
  // message_id is optional — resources can be attached to a channel without a message
  message_id: text(`message_id`)
    .references(() => messagesTable.id, { onDelete: `cascade` }),
  // task_id is optional — resources can be attached directly to a task
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

export const selectTeamSchema = createSelectSchema(teamsTable).extend({
  description: z.string().nullish(),
})
export const createTeamSchema = createInsertSchema(teamsTable).omit({
  created_at: true,
}).extend({
  description: z.string().nullish(),
})
export const updateTeamSchema = createUpdateSchema(teamsTable)

export const selectProjectSchema = createSelectSchema(projectsTable).extend({
  description: z.string().nullish(),
  priority: z.enum(["High", "Mid", "Low"]).nullish(),
  target_date: z.string().nullish(),
  status_percent: z.string().nullish(),
})
export const createProjectSchema = createInsertSchema(projectsTable).omit({
  created_at: true,
})
export const updateProjectSchema = createUpdateSchema(projectsTable)

export const selectBuildUnitSchema = createSelectSchema(buildUnitsTable).extend({
  description: z.string().nullish(),
  health: z.enum(["On track", "At risk", "Off track"]).nullish(),
  priority: z.enum(["High", "Mid", "Low"]).nullish(),
  task_name: z.string().nullish(),
  task_assignee: z.string().nullish(),
  task_since: z.string().nullish(),
  target_date: z.string().nullish(),
  status_percent: z.string().nullish(),
})
export const createBuildUnitSchema = createInsertSchema(buildUnitsTable).omit({
  created_at: true,
})
export const updateBuildUnitSchema = createUpdateSchema(buildUnitsTable)

export const CHANNEL_NAMES = ["Finance", "Requirements", "Design", "Materials", "Tools", "Execution", "Experimentation"] as const
export type ChannelName = typeof CHANNEL_NAMES[number]

export const selectChannelSchema = createSelectSchema(channelsTable).extend({
  name: z.enum(CHANNEL_NAMES),
})
export const createChannelSchema = createInsertSchema(channelsTable).omit({
  created_at: true,
})
export const updateChannelSchema = createUpdateSchema(channelsTable)

export const selectMembershipSchema = createSelectSchema(membershipTable)
export const createMembershipSchema = createInsertSchema(membershipTable).omit({ created_at: true })

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

export const PROPERTY_TYPES = ["priority", "status", "targetDate", "startDate", "pendingTask", "percent_complete", "label"] as const
export const ENTITY_TYPES = ["project", "buildUnit", "channel", "task"] as const
export const STATUS_VALUES = ["critical", "high", "medium", "low"] as const
export const PRIORITY_VALUES = ["notStarted", "inProgress", "onTrack", "atRisk", "backLog", "overBudget", "onHold", "completed", "cancelled"] as const

export const propertiesTable = pgTable(`properties`, {
  id: text(`id`).primaryKey(),
  type: jsonb(`type`).$type<typeof PROPERTY_TYPES[number]>().notNull(),
  entity: jsonb(`entity`).$type<typeof ENTITY_TYPES[number]>().notNull(),
  entity_id: text(`entity_id`).notNull(),
  status_value: jsonb(`status_value`).$type<typeof STATUS_VALUES[number]>(),
  priority_value: jsonb(`priority_value`).$type<typeof PRIORITY_VALUES[number]>(),
  target_date: text(`target_date`),
  start_date: text(`start_date`),
  pending_task: text(`pending_task`),
  label_value: text(`label_value`),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const selectPropertySchema = createSelectSchema(propertiesTable).extend({
  type: z.enum(PROPERTY_TYPES),
  entity: z.enum(ENTITY_TYPES),
  status_value: z.enum(STATUS_VALUES).nullish(),
  priority_value: z.enum(PRIORITY_VALUES).nullish(),
  target_date: z.string().nullish(),
  start_date: z.string().nullish(),
  pending_task: z.string().nullish(),
  label_value: z.string().nullish(),
})
export const createPropertySchema = createInsertSchema(propertiesTable).omit({ created_at: true })
export const updatePropertySchema = createUpdateSchema(propertiesTable)

export type Team = z.infer<typeof selectTeamSchema>
export type UpdateTeam = z.infer<typeof updateTeamSchema>
export type Project = z.infer<typeof selectProjectSchema>
export type UpdateProject = z.infer<typeof updateProjectSchema>
export type BuildUnit = z.infer<typeof selectBuildUnitSchema>
export type UpdateBuildUnit = z.infer<typeof updateBuildUnitSchema>
export type Channel = z.infer<typeof selectChannelSchema>
export type UpdateChannel = z.infer<typeof updateChannelSchema>
export type Membership = z.infer<typeof selectMembershipSchema>
export type Task = z.infer<typeof selectTaskSchema>
export type UpdateTask = z.infer<typeof updateTaskSchema>
export type Message = z.infer<typeof selectMessageSchema>
export type UpdateMessage = z.infer<typeof updateMessageSchema>
export type Resource = z.infer<typeof selectResourceSchema>
export type UpdateResource = z.infer<typeof updateResourceSchema>
export type Property = z.infer<typeof selectPropertySchema>
export type UpdateProperty = z.infer<typeof updatePropertySchema>

export const selectUsersSchema = createSelectSchema(users)
