// Polyfill `AbortSignal.reason` (spec: https://dom.spec.whatwg.org/#dom-abortsignal-reason).
//
// WHY THIS EXISTS — this is the fix for the disappearing-message bug. See
// DISAPPEARING_MESSAGES_INVESTIGATION.md §11.
//
// React Native installs `abort-controller@3.0.0` as the global AbortController
// (react-native/Libraries/Core/setUpXHR.js). That package predates the `reason`
// argument: its `abort()` takes NO parameters and its AbortSignal exposes only
// `aborted`. So `controller.abort(x)` silently discards `x` and `signal.reason`
// is permanently `undefined`.
//
// @electric-sql/client uses the abort REASON to distinguish "this long-poll was
// cancelled so we can immediately re-issue it" from "this stream is done"
// (dist/index.mjs, #requestShape):
//
//   const abortReason = requestAbortController.signal.reason
//   const isRestartAbort = requestAbortController.signal.aborted &&
//     (abortReason === FORCE_DISCONNECT_AND_REFRESH || abortReason === SYSTEM_WAKE)
//   if ((e instanceof FetchError || e instanceof FetchBackoffAbortError) && isRestartAbort) {
//     return this.#requestShape()      // ← re-arms the shape
//   }
//   if (e instanceof FetchBackoffAbortError) return   // ← silent, permanent stop
//
// With `reason` always undefined, `isRestartAbort` is always false and EVERY
// restart-intent abort falls into the silent-stop branch instead: no error, no
// `onError` call, no teardown, no log line — the shape simply never polls again,
// and nothing re-arms it short of a Metro reload. Two library paths depend on it:
//
//   SYSTEM_WAKE                   — #subscribeToWakeDetection. Installed on RN and
//                                   ONLY on RN, because the library picks it whenever
//                                   the browser visibility API is absent (`typeof
//                                   document`). A 2s interval that aborts every
//                                   in-flight long-poll when it sees a >6s wall-clock
//                                   gap. Android produces exactly that gap whenever
//                                   another activity pauses ours — the camera, the
//                                   gallery, the document picker, or the Home button
//                                   (RN's JavaTimerManager.onHostPause stops JS timers).
//   FORCE_DISCONNECT_AND_REFRESH  — ShapeStream.forceDisconnectAndRefresh().
//
// That is the whole mobile/web asymmetry: browsers have `document` (so wake
// detection is never installed) AND a spec-complete `signal.reason`. Mobile had
// neither, so a single trip to the camera killed every shape that happened to have
// a request in flight, and optimistic message rows were then dropped at commit with
// no synced row behind them.
//
// Restoring `reason` re-enables the library's OWN recovery path rather than
// bolting a second one on top of it. Import this for side effects before any
// ShapeStream is constructed.
//
// Remove when React Native ships a spec-complete AbortController (checked on RN
// 0.83.4 — still abort-controller@3.0.0). The guard below makes that safe: this
// becomes a no-op the moment the runtime supports `reason` natively.

const supportsReason = (): boolean => {
  try {
    const controller = new AbortController()
    controller.abort("probe")
    return controller.signal.reason === "probe"
  } catch {
    return false
  }
}

export function installAbortSignalReasonPolyfill(): void {
  if (typeof AbortController === "undefined" || supportsReason()) return

  const proto = AbortController.prototype
  const originalAbort = proto.abort

  proto.abort = function abort(this: AbortController, reason?: unknown): void {
    // Stamp the reason BEFORE delegating: the original abort() dispatches the
    // `abort` event synchronously, and listeners must already be able to read it.
    // Only set it when a reason was actually passed — leaving the absent case as
    // `undefined` matches today's behaviour exactly, so this can only add
    // information, never change an existing code path. (The spec would substitute
    // an AbortError DOMException here; fabricating one risks flipping `if
    // (signal.reason)` checks in other libraries that have always seen undefined.)
    if (reason !== undefined && !this.signal.aborted) {
      try {
        Object.defineProperty(this.signal, "reason", {
          value: reason,
          configurable: true,
          enumerable: true,
          writable: true,
        })
      } catch {
        // Non-configurable for some reason — fall through and abort anyway. The
        // stream loses its restart hint but behaves no worse than before.
      }
    }
    originalAbort.call(this)
  }
}
