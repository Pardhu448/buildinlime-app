import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  coerceBool,
  NEVER_GC,
  retryOnError,
  membershipsShapeErrored,
  clearMembershipsShapeError,
  retryOnMembershipsError,
} from "%/application/collections/_shared"

describe("coerceBool", () => {
  it("coerces Electric's stringy booleans and true booleans", () => {
    expect(coerceBool("true")).toBe(true)
    expect(coerceBool(true)).toBe(true)
  })

  it("treats everything else as false", () => {
    expect(coerceBool("false")).toBe(false)
    expect(coerceBool(false)).toBe(false)
    expect(coerceBool(undefined)).toBe(false)
    expect(coerceBool("anything")).toBe(false)
  })
})

describe("NEVER_GC", () => {
  it("is non-finite so startGCTimer() never schedules (ARCHITECTURE.md §6)", () => {
    expect(Number.isFinite(NEVER_GC)).toBe(false)
  })
})

describe("retryOnError backoff", () => {
  it("waits 2s on a 401 and 5s on anything else", async () => {
    vi.useFakeTimers()
    try {
      let a = false
      let b = false
      void retryOnError(new Error("401 not ready")).then(() => (a = true))
      void retryOnError(new Error("500 boom")).then(() => (b = true))

      await vi.advanceTimersByTimeAsync(1999)
      expect(a).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect(a).toBe(true) // 401 → 2000ms
      expect(b).toBe(false)

      await vi.advanceTimersByTimeAsync(3000)
      expect(b).toBe(true) // other → 5000ms
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("memberships shape error tracking", () => {
  beforeEach(() => clearMembershipsShapeError())

  it("is clear after a clean start", () => {
    expect(membershipsShapeErrored()).toBe(false)
  })

  it("flags an error synchronously, and clears on demand", () => {
    vi.useFakeTimers()
    try {
      // Sets the flag before awaiting the backoff — the load-bearing behaviour
      // the bootstrap depends on (a 'ready + 0 rows + errored' membership shape
      // must count as NOT loaded, not as a brand-new user).
      void retryOnMembershipsError(new Error("500"))
      expect(membershipsShapeErrored()).toBe(true)
      vi.runAllTimers()
    } finally {
      vi.useRealTimers()
    }
    clearMembershipsShapeError()
    expect(membershipsShapeErrored()).toBe(false)
  })
})
