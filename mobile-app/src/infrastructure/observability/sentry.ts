import * as Sentry from "@sentry/react-native"

// Crash reporting — DSN-driven, off by default.
//
// The DSN comes from EXPO_PUBLIC_SENTRY_DSN, inlined by Metro at build time the
// same way EXPO_PUBLIC_API_URL is (a client DSN is publishable — it is not a
// secret). It is set per EAS build profile (see eas.json), NOT committed, so:
//   - local dev / tests with no DSN         -> init is a no-op, nothing is sent
//   - production/preview builds with a DSN  -> crashes + errors are reported
//
// Kept out of app.json's runtime so there is a single guarded entry point
// (initSentry) rather than a bare Sentry.init() scattered at import time.

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN

let started = false

/**
 * Initialise Sentry once, if a DSN is configured. Safe to call unconditionally:
 * with no DSN (local dev, unit tests) it does nothing. Returns whether Sentry
 * was actually started, mostly for logging/tests.
 */
export function initSentry(): boolean {
  if (started) return true
  if (!dsn) {
    if (__DEV__) console.log("[sentry] no EXPO_PUBLIC_SENTRY_DSN — crash reporting disabled")
    return false
  }

  Sentry.init({
    dsn,
    // Don't ship dev-machine noise to the production project; native crash
    // handlers still install so the wiring is exercised, events just aren't sent.
    enabled: !__DEV__,
    // Conservative default — raise once there's a baseline of traffic.
    tracesSampleRate: 0.2,
    // The API base URL is not a secret, but avoid leaking request bodies
    // (message text, upload metadata) into breadcrumbs.
    sendDefaultPii: false,
  })

  started = true
  return true
}

export { Sentry }
