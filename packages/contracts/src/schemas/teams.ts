import { z } from "zod"

// Wire contract for teams. See schemas/tasks.ts for the shared design.

export const createTeamInput = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  owner_id: z.string(),
  project_id: z.string(),
  member_ids: z.array(z.string()).default([]),
})

// owner_id / project_id are not re-settable through update (see the note in
// schemas/tasks.ts about narrowing patch shapes).
export const teamPatchInput = z.object({
  name: z.string().optional(),
  description: z.string().nullish(),
  member_ids: z.array(z.string()).default([]),
})

export const updateTeamInput = z.object({ id: z.string(), data: teamPatchInput })
export const deleteTeamInput = z.object({ id: z.string() })
