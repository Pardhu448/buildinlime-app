import { initTRPC } from "@trpc/server"

// The contract router (src/router.ts) is TYPE-ONLY. It exists so a client can
// derive a fully-typed AppRouter without importing the server's implementation —
// which would pull in drizzle, better-auth and the live database connection. The
// mobile client imports the router with `import type`, so nothing here ever runs.
type ContractContext = Record<string, never>

const t = initTRPC.context<ContractContext>().create()

export const router = t.router
export const procedure = t.procedure

// Every mutation returns Postgres's txid for Electric correlation plus the row.
// Clients don't consume `item` today (the outbox reconciles by id — see
// ARCHITECTURE.md §5), so `unknown` is deliberate: the contract pins inputs, not
// outputs.
export type MutationResult = { item: unknown; txid: number }

// Stub body for a contract procedure. Never executed — the router is type-only.
export const stub = (): MutationResult => {
  throw new Error("contract router is type-only and must not be invoked")
}

/**
 * Stub for a procedure whose OUTPUT the client actually reads.
 *
 * The default `stub` above is mutation-shaped, and outputs are deliberately not
 * pinned — clients don't consume `item`. Queries are different: a client that
 * destructures the result needs its shape, or the call types as a mutation
 * result and the field it wants "does not exist". `users.checkEmail` is the
 * case that surfaced this.
 */
export const stubOf =
  <T,>(): (() => T) =>
  () => {
    throw new Error("contract router is type-only and must not be invoked")
  }
