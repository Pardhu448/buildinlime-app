import { describe, it, expect } from "vitest"
import { NON_RETRIABLE_TRPC_CODES as CANONICAL } from "@buildinlime/domain-types"
import { NON_RETRIABLE_TRPC_CODES as WEB_SET } from "%/infrastructure/offline/mutation-fns"

// The offline outbox drains strictly in order and retries retriable errors
// forever, so the non-retriable set must be exactly right or a permanently-
// rejected write wedges the queue (ARCHITECTURE.md §5). This set drifted once —
// CONFLICT was in mobile but missing from web (§10). This guards web against the
// canonical list; a matching spec guards mobile.
describe("web non-retriable tRPC codes", () => {
  it("matches the canonical set in @buildinlime/domain-types", () => {
    expect([...WEB_SET].sort()).toEqual([...CANONICAL].sort())
  })

  it("includes CONFLICT — the code that drifted before", () => {
    expect(WEB_SET.has("CONFLICT")).toBe(true)
  })
})
