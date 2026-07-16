// Wire contracts shared by the server (input validation) and the mobile client
// (AppRouter type). See ARCHITECTURE.md §10 / §12.4.
export * from "./schemas/tasks"
export * from "./schemas/organization"
export * from "./schemas/teams"
export * from "./schemas/communication"
export * from "./schemas/seen"
export type { AppRouter } from "./router"
export type { MutationResult } from "./trpc"
