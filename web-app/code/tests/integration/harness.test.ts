import { describe, it, expect } from "vitest"

// Phase 1 smoke test — proves the Vitest `integration` project boots in a node
// environment. The real Postgres harness (makeCtx, migrations, truncation)
// lands in Phase 2; replace this file with actual router specs then.
describe("integration harness", () => {
  it("runs in a node environment", () => {
    // jsdom would define `document`; the integration project must not.
    expect(typeof document).toBe("undefined")
    expect(1 + 1).toBe(2)
  })
})
