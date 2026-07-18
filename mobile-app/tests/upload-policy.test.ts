import { describe, it, expect, vi, afterEach } from "vitest"
import {
  nextRetryDelay,
  shouldAutoRetry,
  statusForFailure,
  isRetryableStatus,
  scheduleDecision,
  MAX_AUTO_RETRIES,
  MAX_BACKOFF_MS,
} from "@buildinlime/sync-core"

// The pending-upload policy shared by web's usePendingResources and mobile's
// upload-manager. Pure functions, so they are tested here directly — mobile's
// vitest is the plain-node runner the workspace already uses for sync-core
// logic. The values below are the ones BOTH apps inlined before the extraction;
// this file is what stops the two drifting apart again.

afterEach(() => {
  vi.useRealTimers()
})

describe("nextRetryDelay", () => {
  it("doubles from 1s and caps at the ceiling", () => {
    expect(nextRetryDelay(1)).toBe(1000)
    expect(nextRetryDelay(2)).toBe(2000)
    expect(nextRetryDelay(3)).toBe(4000)
    expect(nextRetryDelay(4)).toBe(8000)
    expect(nextRetryDelay(5)).toBe(16000)
    // Attempt 6 would be 32s uncapped.
    expect(nextRetryDelay(6)).toBe(MAX_BACKOFF_MS)
    expect(nextRetryDelay(50)).toBe(MAX_BACKOFF_MS)
  })
})

describe("shouldAutoRetry", () => {
  it("retries while under the cap and online", () => {
    expect(shouldAutoRetry(1, true)).toBe(true)
    expect(shouldAutoRetry(MAX_AUTO_RETRIES, true)).toBe(true)
    expect(shouldAutoRetry(MAX_AUTO_RETRIES + 1, true)).toBe(false)
  })

  it("never arms a timer while offline — reconnect is what wakes those", () => {
    expect(shouldAutoRetry(1, false)).toBe(false)
    expect(shouldAutoRetry(MAX_AUTO_RETRIES, false)).toBe(false)
  })
})

describe("statusForFailure", () => {
  it("distinguishes a real error from merely being offline", () => {
    expect(statusForFailure(true)).toBe("error")
    expect(statusForFailure(false)).toBe("awaiting_network")
  })
})

describe("isRetryableStatus", () => {
  it("covers exactly the two failure states", () => {
    expect(isRetryableStatus("error")).toBe(true)
    expect(isRetryableStatus("awaiting_network")).toBe(true)
    expect(isRetryableStatus("uploading")).toBe(false)
    expect(isRetryableStatus("scheduled")).toBe(false)
    expect(isRetryableStatus("awaiting_schedule")).toBe(false)
  })
})

describe("scheduleDecision", () => {
  it("uploads now when there is no schedule", () => {
    expect(scheduleDecision(null)).toEqual({ kind: "now" })
  })

  it("uploads now when the time has already passed", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-18T12:00:00Z"))
    expect(scheduleDecision(new Date("2026-07-18T11:59:59Z"))).toEqual({ kind: "now" })
    // Exactly now counts as passed — a zero delay must not arm a timer.
    expect(scheduleDecision(new Date("2026-07-18T12:00:00Z"))).toEqual({ kind: "now" })
  })

  it("waits the remaining time when the schedule is in the future", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-18T12:00:00Z"))
    expect(scheduleDecision(new Date("2026-07-18T12:00:30Z"))).toEqual({
      kind: "later",
      delayMs: 30_000,
    })
  })
})
