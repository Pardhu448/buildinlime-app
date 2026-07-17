import { z } from "zod"
import { CHANNEL_NAMES } from "@buildinlime/domain-types"

// Wire contracts for the organization hierarchy: projects, build units, channels.
// See schemas/tasks.ts for the shared design (server validates against these;
// mobile's AppRouter type is derived from them; the server's insert/update calls
// type-check the inferred shapes against drizzle, so drift fails `pnpm typecheck`).

const projectPriority = z.enum(["High", "Mid", "Low"])

// -------------------- projects --------------------

export const createProjectInput = z.object({
  id: z.string(),
  name: z.string().max(255),
  description: z.string().nullish(),
  priority: projectPriority.nullish(),
  target_date: z.string().max(100).nullish(),
  owner_id: z.string(),
  status_percent: z.string().max(10).nullish(),
})

// Only content columns are updatable. id / owner_id / created_at are deliberately
// NOT accepted here — the server's `.set(input.data)` would otherwise let a client
// reparent or reassign ownership (see the equivalent note in schemas/tasks.ts).
export const projectPatchInput = z.object({
  name: z.string().max(255).optional(),
  description: z.string().nullish(),
  priority: projectPriority.nullish(),
  target_date: z.string().max(100).nullish(),
  status_percent: z.string().max(10).nullish(),
})

export const updateProjectInput = z.object({ id: z.string(), data: projectPatchInput })
export const deleteProjectInput = z.object({ id: z.string() })

// -------------------- build units --------------------

const buildUnitHealth = z.enum(["On track", "At risk", "Off track"])

export const createBuildUnitInput = z.object({
  id: z.string(),
  name: z.string().max(255),
  description: z.string().nullish(),
  health: buildUnitHealth.nullish(),
  priority: projectPriority.nullish(),
  task_name: z.string().max(255).nullish(),
  task_assignee: z.string().max(255).nullish(),
  task_since: z.string().max(100).nullish(),
  target_date: z.string().max(100).nullish(),
  status_percent: z.string().max(10).nullish(),
  project_id: z.string(),
  owner_id: z.string(),
})

export const buildUnitPatchInput = z.object({
  name: z.string().max(255).optional(),
  description: z.string().nullish(),
  health: buildUnitHealth.nullish(),
  priority: projectPriority.nullish(),
  task_name: z.string().max(255).nullish(),
  task_assignee: z.string().max(255).nullish(),
  task_since: z.string().max(100).nullish(),
  target_date: z.string().max(100).nullish(),
  status_percent: z.string().max(10).nullish(),
})

export const updateBuildUnitInput = z.object({ id: z.string(), data: buildUnitPatchInput })
export const deleteBuildUnitInput = z.object({ id: z.string() })

// -------------------- channels --------------------
// name is one of the seven fixed channel names (domain-types CHANNEL_NAMES), a
// notNull jsonb column on the table.

export const createChannelInput = z.object({
  id: z.string(),
  name: z.enum(CHANNEL_NAMES),
  description: z.string().nullish(),
  buildunit_id: z.string(),
  owner_id: z.string(),
})

export const channelPatchInput = z.object({
  name: z.enum(CHANNEL_NAMES).optional(),
  description: z.string().nullish(),
})

export const updateChannelInput = z.object({ id: z.string(), data: channelPatchInput })
export const deleteChannelInput = z.object({ id: z.string() })
