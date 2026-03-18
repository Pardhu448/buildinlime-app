import { pgTable, timestamp, text } from "drizzle-orm/pg-core"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"
import { users } from "./auth-schema"
import { projectsTable } from "./organization-tables"

const { createInsertSchema, createSelectSchema, createUpdateSchema } =
  createSchemaFactory({ zodInstance: z })

export const teamsTable = pgTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  owner_id: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  project_id: text('project_id')
    .notNull()
    .references(() => projectsTable.id, { onDelete: 'cascade' }),
  member_ids: text('member_ids').array().notNull(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const selectTeamSchema = createSelectSchema(teamsTable).extend({
  description: z.string().nullish(),
  member_ids: z.array(z.string()).default([]),
})
export const createTeamSchema = createInsertSchema(teamsTable).omit({
  created_at: true,
}).extend({
  description: z.string().nullish(),
  member_ids: z.array(z.string()).default([]),
})
export const updateTeamSchema = createUpdateSchema(teamsTable)

export const selectUsersSchema = createSelectSchema(users)

export type Team = z.infer<typeof selectTeamSchema>
export type UpdateTeam = z.infer<typeof updateTeamSchema>
