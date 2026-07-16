// Shared helpers used across Electric collection files. The framework-free common
// parts (shape retry, memberships error tracking, GC tiers, coerceBool) live once
// in @buildinlime/sync-core; this file re-exports them and adds the web-only bits.
import { makeShapeRetry } from "@buildinlime/sync-core"

export { NEVER_GC, IDLE_GC_MS, coerceBool } from "@buildinlime/sync-core"

// Web omits the dev retry log (mobile wires one — see makeShapeRetry). One instance
// per app, so the memberships-error flag stays a per-app singleton.
export const {
  retryOnError,
  retryOnMembershipsError,
  membershipsShapeErrored,
  clearMembershipsShapeError,
} = makeShapeRetry()

export const origin = typeof window !== `undefined`
  ? window.location.origin
  : `https://localhost:5173`
