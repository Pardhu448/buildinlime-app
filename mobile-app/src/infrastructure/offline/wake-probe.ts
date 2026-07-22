import { AppState, type AppStateStatus } from "react-native"

// DIAGNOSTIC (dev-only) — retained as a REGRESSION probe. See
// DISAPPEARING_MESSAGES_INVESTIGATION.md §11.
//
// It was written to test one claim: that backgrounding the app (the camera /
// gallery / document picker each start their own Android activity, and so does the
// Home button) freezes RN's JS timers for long enough that @electric-sql/client's
// wake detection aborts every shape long-poll on resume. That claim is CONFIRMED
// (§11.4) and the abort is now survivable — `abort-signal-reason.ts` restores
// `signal.reason` so the library recognises its own restart abort and re-issues the
// poll instead of stopping for good.
//
// The probe stays because it is the only way to correlate a JS-timer gap with an
// abort, and because §11.4's confirmation caught an in-flight abort by chance
// rather than by design. Remove it with the §5 instrumentation once a deliberate
// long-background run is clean.
//
// This loop is a deliberate COPY of the library's private one — same period, same
// threshold — so that when it reports a gap, every ShapeStream's own timer saw the
// same gap at the same moment:
//
//   @electric-sql/client/dist/index.mjs → subscribeToWakeDetection_fn
//     const INTERVAL_MS = 2e3
//     const WAKE_THRESHOLD_MS = 4e3
//     if (elapsed > INTERVAL_MS + WAKE_THRESHOLD_MS) this.#requestAbortController.abort(SYSTEM_WAKE)
//
// That path is installed on mobile — and ONLY on mobile — because the library
// picks it whenever the browser visibility API is absent (`typeof document`), so
// React Native gets the Node/Bun sleep-detection fallback instead of the graceful
// visibility pause the web app gets. Keep the constants in sync with the library
// if it is ever upgraded; a drift here makes the probe lie.
const INTERVAL_MS = 2_000
const WAKE_THRESHOLD_MS = 4_000

let timer: ReturnType<typeof setInterval> | null = null
let appStateSub: { remove: () => void } | null = null

const stamp = () => new Date().toISOString().slice(11, 23)

/**
 * Start the probe. Call once at app start; no-ops outside __DEV__ and on a second
 * call. Prints two interleaved streams to the Metro log:
 *
 *   [wake] appstate active → background   — the moment the activity pauses
 *   [wake] GAP 10412ms — Electric WOULD ABORT every in-flight shape long-poll here
 *
 * Read it together with the existing `[net#]` lines. What you want to see after a
 * GAP is each aborted poll re-issued for the SAME path:
 *
 *   [net#44] ✗ /api/resources THREW after 15361ms (inflight 9): AbortError: Aborted
 *   [net#54] → GET /api/resources (inflight 10)
 *
 * A GAP followed by an `AbortError` with NO matching re-issued GET is the
 * regression: the shape is dead for the session and messages will start vanishing
 * again. Check `abort-signal-reason.ts` is still installed ahead of collection init.
 *
 * A GAP that aborts nothing at all is normal and NOT a pass. The abort only fires on
 * a request that is still open, and the server releases a long-poll after ~20s — so
 * the window is "older than 6s and younger than ~20s". Backgrounding for 30s or a
 * minute measures the timer freeze but exercises nothing, because every poll has
 * already been answered by the time you return (§11.4a).
 *
 * To make it fire: Home for ~10s and return (flushes the stale polls, issues fresh
 * ones), then Home again for ~10s within the next ~15s. The second trip is the test.
 */
export function startWakeProbe(): void {
  if (!__DEV__ || timer) return

  let lastTick = Date.now()
  timer = setInterval(() => {
    const now = Date.now()
    const elapsed = now - lastTick
    lastTick = now
    if (elapsed > INTERVAL_MS + WAKE_THRESHOLD_MS) {
      console.log(
        `[wake] ${stamp()} GAP ${elapsed}ms — Electric WOULD ABORT every in-flight shape long-poll here`,
      )
    }
  }, INTERVAL_MS)

  // Logged separately from the gap because the two answer different questions:
  // the transition says the activity paused, the gap says the timers actually
  // froze for long enough to matter. A background/foreground pair with NO gap
  // between them (a sub-6s trip to the camera) is the case that does not trip the
  // bug, and is worth being able to see.
  let prev: AppStateStatus = AppState.currentState
  appStateSub = AppState.addEventListener(`change`, (next) => {
    console.log(`[wake] ${stamp()} appstate ${prev} → ${next}`)
    prev = next
  })

  console.log(`[wake] probe armed (interval ${INTERVAL_MS}ms, threshold ${INTERVAL_MS + WAKE_THRESHOLD_MS}ms)`)
}

/** Stop the probe. Only needed if the module is ever hot-reloaded. */
export function stopWakeProbe(): void {
  if (timer) clearInterval(timer)
  timer = null
  appStateSub?.remove()
  appStateSub = null
}
