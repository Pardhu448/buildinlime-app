import { describe, it, expect, vi } from "vitest"
import { NON_RETRIABLE_TRPC_CODES as CANONICAL } from "@buildinlime/domain-types"

// Guards the mobile non-retriable set against the canonical list (see the web
// twin in web-app/code/tests/unit). CONFLICT was once present here but MISSING
// from web (ARCHITECTURE.md §10) — this pins mobile so the pair cannot silently
// diverge again.

// mutation-fns → trpc/client and → _shared both reach cookie-fetch, which pulls
// in expo-secure-store (native). Mock that one boundary and the whole chain
// imports cleanly in node.
vi.mock("@/src/infrastructure/auth/cookie-fetch", () => ({
  createCookieFetch: () => vi.fn(),
  getAuthHeaders: async () => ({}),
}))

describe("mobile non-retriable tRPC codes", () => {
  it("matches the canonical set in @buildinlime/domain-types", async () => {
    const { NON_RETRIABLE_TRPC_CODES: MOBILE_SET } = await import(
      "@/src/infrastructure/offline/mutation-fns"
    )
    expect([...MOBILE_SET].sort()).toEqual([...CANONICAL].sort())
  })

  it("includes CONFLICT", async () => {
    const { NON_RETRIABLE_TRPC_CODES: MOBILE_SET } = await import(
      "@/src/infrastructure/offline/mutation-fns"
    )
    expect(MOBILE_SET.has("CONFLICT")).toBe(true)
  })
})
