// Shared client write-action factories, parameterized by injected platform
// primitives (see platform.ts). One copy of the optimistic-action logic that web
// and mobile both bind to their own executor + collections. See ARCHITECTURE.md §10.
export * from "./platform"
export * from "./collections"
export * from "./mutation-fns"
export * from "./upload-policy"
export * from "./actions/tasks"
export * from "./actions/messages"
export * from "./actions/properties"
export * from "./actions/resources"
export * from "./actions/teams"
export * from "./actions/seen"
