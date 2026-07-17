import { z } from "zod"

// The wire contract for task mutations — the single source of truth shared by the
// server routers (which validate against it) and the mobile client's AppRouter
// type (which is derived from it). The server proves these stay compatible with
// the database at compile time: `tx.insert(tasksTable).values(input)` type-checks
// this schema's inferred type against drizzle's insert type, so a shape that the
// table would reject fails `pnpm typecheck` rather than at runtime.

// createInsertSchema(tasksTable) minus the server-stamped columns
// (opened_at / closed_at / deleted_at / deleted_by_id). Lengths mirror the
// varchar() column limits so an over-long value fails fast client-side rather
// than 500-ing on insert (a raw 500 is retriable and would wedge the outbox).
export const createTaskInput = z.object({
  id: z.string(),
  name: z.string().max(255),
  description: z.string().max(500),
  completed: z.boolean().optional(),
  channel_id: z.string(),
  buildunit_id: z.string(),
  createdby_id: z.string(),
  assignee_id: z.string().nullish(),
})

// The only fields a task's lifecycle may change. Deliberately NOT the full insert
// shape: createdby_id / channel_id / buildunit_id must not be reassignable through
// update (see tasks router). closed_at is accepted so status changes can stamp it.
export const taskPatchInput = z.object({
  name: z.string().max(255).optional(),
  description: z.string().max(500).optional(),
  completed: z.boolean().optional(),
  assignee_id: z.string().nullish(),
  closed_at: z.coerce.date().optional(),
})

export const updateTaskInput = z.object({
  id: z.string(),
  data: taskPatchInput,
})

export const deleteTaskInput = z.object({ id: z.string() })

export type CreateTaskInput = z.infer<typeof createTaskInput>
export type UpdateTaskInput = z.infer<typeof updateTaskInput>
export type DeleteTaskInput = z.infer<typeof deleteTaskInput>
