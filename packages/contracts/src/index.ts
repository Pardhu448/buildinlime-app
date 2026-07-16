// Wire contracts shared by the server (input validation) and the mobile client
// (AppRouter type). See ARCHITECTURE.md §10 / §12.4.
//
// Two halves: the schemas/* below describe what a client SENDS, and schemas/rows
// describes what an Electric shape STREAMS BACK — the latter shared by both
// clients' collection definitions and asserted against drizzle server-side.
export * from "./schemas/rows"
export * from "./schemas/tasks"
export * from "./schemas/organization"
export * from "./schemas/teams"
export * from "./schemas/communication"
export * from "./schemas/seen"
export type { AppRouter } from "./router"
export type { MutationResult } from "./trpc"
