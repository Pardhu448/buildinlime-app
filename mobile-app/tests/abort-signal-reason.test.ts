import { describe, it, expect, afterEach } from "vitest"

import { installAbortSignalReasonPolyfill } from "@/src/infrastructure/polyfills/abort-signal-reason"

// The polyfill exists for React Native's global AbortController, which is
// abort-controller@3.0.0 — abort() takes no arguments and the signal has no
// `reason`. Node's built-in AbortController is spec-complete, so these tests
// stand up a faithful stand-in for the legacy one and swap it into the global
// for the duration. Without that, every assertion here would pass for the wrong
// reason (Node's native `reason`) and the test would prove nothing.
class LegacyAbortSignal {
  aborted = false
  private listeners: Array<() => void> = []
  addEventListener(_type: string, listener: () => void) {
    this.listeners.push(listener)
  }
  dispatch() {
    for (const listener of this.listeners) listener()
  }
}

class LegacyAbortController {
  signal = new LegacyAbortSignal()
  // Note the empty parameter list — this is the whole defect being polyfilled.
  abort() {
    if (this.signal.aborted) return
    this.signal.aborted = true
    this.signal.dispatch()
  }
}

const native = globalThis.AbortController

function useLegacyAbortController() {
  ;(globalThis as any).AbortController = LegacyAbortController
}

afterEach(() => {
  ;(globalThis as any).AbortController = native
})

describe("installAbortSignalReasonPolyfill", () => {
  it("records the abort reason on the signal", () => {
    useLegacyAbortController()
    installAbortSignalReasonPolyfill()

    const controller = new AbortController()
    controller.abort("system-wake")

    expect(controller.signal.aborted).toBe(true)
    expect(controller.signal.reason).toBe("system-wake")
  })

  it("exposes the reason to abort listeners synchronously", () => {
    // Electric reads signal.reason after the fetch rejects, but other consumers
    // read it inside the abort event. Stamping before delegating is what makes
    // both work, so pin it.
    useLegacyAbortController()
    installAbortSignalReasonPolyfill()

    const controller = new AbortController()
    let seen: unknown = "not-called"
    controller.signal.addEventListener("abort", () => {
      seen = controller.signal.reason
    })
    controller.abort("force-disconnect-and-refresh")

    expect(seen).toBe("force-disconnect-and-refresh")
  })

  it("leaves reason undefined when abort() is called with no argument", () => {
    // Deliberately NOT spec behaviour (the spec substitutes an AbortError
    // DOMException). Matching today's observed value keeps the polyfill purely
    // additive for any library that has only ever seen undefined here.
    useLegacyAbortController()
    installAbortSignalReasonPolyfill()

    const controller = new AbortController()
    controller.abort()

    expect(controller.signal.aborted).toBe(true)
    expect(controller.signal.reason).toBeUndefined()
  })

  it("keeps the first reason when abort() is called twice", () => {
    useLegacyAbortController()
    installAbortSignalReasonPolyfill()

    const controller = new AbortController()
    controller.abort("first")
    controller.abort("second")

    expect(controller.signal.reason).toBe("first")
  })

  it("is a no-op on a runtime that already supports reason", () => {
    // Node's native AbortController is left in place here. If the polyfill
    // patched it anyway, a future RN upgrade would silently get double-wrapped.
    const before = AbortController.prototype.abort
    installAbortSignalReasonPolyfill()
    expect(AbortController.prototype.abort).toBe(before)

    const controller = new AbortController()
    controller.abort("native")
    expect(controller.signal.reason).toBe("native")
  })
})
