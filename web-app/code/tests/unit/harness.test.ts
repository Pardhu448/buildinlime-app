import { describe, it, expect } from "vitest"

// Phase 1 smoke test — proves the Vitest `unit` project boots and the jsdom
// environment is live. Delete once real unit specs exist (Phase 3).
describe("test harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2)
  })

  it("has a DOM (jsdom environment)", () => {
    expect(typeof document).toBe("object")
    const el = document.createElement("div")
    el.textContent = "ok"
    expect(el.textContent).toBe("ok")
  })
})
