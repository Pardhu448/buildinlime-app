import { router, procedure, stub, stubOf } from "./trpc"
import { createTaskInput, updateTaskInput, deleteTaskInput } from "./schemas/tasks"
import {
  createProjectInput,
  updateProjectInput,
  deleteProjectInput,
  createBuildUnitInput,
  updateBuildUnitInput,
  deleteBuildUnitInput,
  createChannelInput,
  updateChannelInput,
  deleteChannelInput,
} from "./schemas/organization"
import { createTeamInput, updateTeamInput, deleteTeamInput } from "./schemas/teams"
import {
  createMessageInput,
  deleteMessageInput,
  deleteResourceInput,
  createPropertyInput,
  updatePropertyInput,
  deletePropertyInput,
} from "./schemas/communication"
import { markSeenInput } from "./schemas/seen"
import { checkEmailInput } from "./schemas/users"

// The wire contract, expressed as a tRPC router so its `typeof` is a real
// AppRouter the client can type its calls against. Procedure NAMES and namespaces
// here must match the server's appRouter (web-app .../routes/api/trpc/$.ts); the
// INPUT SCHEMAS are shared with the server, so those cannot drift.
//
// This covers the surface the MOBILE client calls (ARCHITECTURE.md §10). The web
// client uses the server's own AppRouter directly, so genuinely web-only
// procedures (channels.addMember/removeMember, the rest of users.*) are not
// mirrored here. `users.checkEmail` IS mirrored: mobile's login screen calls it,
// and while it was excluded as "web-only" that call was untyped.
export const contractRouter = router({
  tasks: router({
    create: procedure.input(createTaskInput).mutation(stub),
    update: procedure.input(updateTaskInput).mutation(stub),
    delete: procedure.input(deleteTaskInput).mutation(stub),
  }),
  projects: router({
    create: procedure.input(createProjectInput).mutation(stub),
    update: procedure.input(updateProjectInput).mutation(stub),
    delete: procedure.input(deleteProjectInput).mutation(stub),
  }),
  buildUnits: router({
    create: procedure.input(createBuildUnitInput).mutation(stub),
    update: procedure.input(updateBuildUnitInput).mutation(stub),
    delete: procedure.input(deleteBuildUnitInput).mutation(stub),
  }),
  channels: router({
    create: procedure.input(createChannelInput).mutation(stub),
    update: procedure.input(updateChannelInput).mutation(stub),
    delete: procedure.input(deleteChannelInput).mutation(stub),
  }),
  teams: router({
    create: procedure.input(createTeamInput).mutation(stub),
    update: procedure.input(updateTeamInput).mutation(stub),
    delete: procedure.input(deleteTeamInput).mutation(stub),
  }),
  messages: router({
    create: procedure.input(createMessageInput).mutation(stub),
    delete: procedure.input(deleteMessageInput).mutation(stub),
  }),
  resources: router({
    delete: procedure.input(deleteResourceInput).mutation(stub),
  }),
  properties: router({
    create: procedure.input(createPropertyInput).mutation(stub),
    update: procedure.input(updatePropertyInput).mutation(stub),
    delete: procedure.input(deletePropertyInput).mutation(stub),
  }),
  users: router({
    checkEmail: procedure.input(checkEmailInput).query(stubOf<{ exists: boolean }>()),
  }),
  seen: router({
    markSeen: procedure.input(markSeenInput).mutation(stub),
  }),
})

export type AppRouter = typeof contractRouter
