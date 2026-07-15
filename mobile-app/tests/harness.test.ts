import { describe, it, expect } from "vitest"

// Phase 1 smoke test — proves the mobile Vitest runner boots in a node
// environment. Replace with real offline/upload-manager specs in Phase 3.
describe("mobile test harness", () => {
  it("runs in a node environment", () => {
    expect(typeof document).toBe("undefined")
    expect(1 + 1).toBe(2)
  })
})
