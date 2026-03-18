import {
  pgTable,
  timestamp,
  varchar,
  text,
  boolean,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"
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

export const CHANNEL_NAMES = ["Finance", "Requirements", "Design", "Materials", "Tools", "Execution", "Experimentation"] as const
export type ChannelName = typeof CHANNEL_NAMES[number]

export const channelsTable = pgTable(`channels`, {
  id: text(`id`).primaryKey(),
  name: jsonb(`name`).$type<ChannelName>().notNull(),
  description: text(),
  buildunit_id: text(`buildunit_id`)
    .notNull()
    .references(() => buildUnitsTable.id, { onDelete: `cascade` }),
  owner_id: text(`owner_id`)
    .notNull()
    .references(() => users.id, { onDelete: `cascade` }),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const MEMBERSHIP_ROLES = [`owner`, `co-owner`, `viewer`] as const
export type MembershipRole = typeof MEMBERSHIP_ROLES[number]

export const membershipTable = pgTable(`memberships`, {
  id: text(`id`).primaryKey(),
  user_id: text(`user_id`).notNull().references(() => users.id, { onDelete: `cascade` }),
  channel_id: text(`channel_id`).notNull().references(() => channelsTable.id, { onDelete: `cascade` }),
  buildunit_id: text(`buildunit_id`).notNull().references(() => buildUnitsTable.id, { onDelete: `cascade` }),
  project_id: text(`project_id`).notNull().references(() => projectsTable.id, { onDelete: `cascade` }),
  member_flag: boolean(`member_flag`).notNull().default(true),
  role: text(`role`).$type<MembershipRole>().notNull().default(`viewer`),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex(`memberships_user_channel_unique`).on(t.user_id, t.channel_id)])

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

export const selectChannelSchema = createSelectSchema(channelsTable).extend({
  name: z.enum(CHANNEL_NAMES),
})
export const createChannelSchema = createInsertSchema(channelsTable).omit({
  created_at: true,
})
export const updateChannelSchema = createUpdateSchema(channelsTable)

export const selectMembershipSchema = createSelectSchema(membershipTable).extend({
  role: z.enum(MEMBERSHIP_ROLES).default(`viewer`),
})
export const createMembershipSchema = createInsertSchema(membershipTable).omit({ created_at: true }).extend({
  role: z.enum(MEMBERSHIP_ROLES).default(`viewer`),
})

export type Project = z.infer<typeof selectProjectSchema>
export type UpdateProject = z.infer<typeof updateProjectSchema>
export type BuildUnit = z.infer<typeof selectBuildUnitSchema>
export type UpdateBuildUnit = z.infer<typeof updateBuildUnitSchema>
export type Channel = z.infer<typeof selectChannelSchema>
export type UpdateChannel = z.infer<typeof updateChannelSchema>
export type Membership = z.infer<typeof selectMembershipSchema>
