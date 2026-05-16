import NetInfo from "@react-native-community/netinfo"
import type { NetInfoState } from "@react-native-community/netinfo"
import { AppState } from "react-native"
import type { OnlineDetector } from "@tanstack/offline-transactions"

// Custom OnlineDetector for the offline executor.
//
// The library's built-in ReactNativeOnlineDetector calls notifyListeners()
// BEFORE updating its internal `wasConnected` flag. The executor, woken by
// that notification, immediately checks isOnline() — and sees the STALE
// offline value, so runExecution() breaks and no retry is scheduled. Result:
// transactions queued while offline never drain when connectivity returns.
//
// This implementation updates `online` BEFORE notifying, so the executor
// observes the correct state when it wakes.
//
// SHARED SINGLETON: both the offline executor and the upload manager need a
// connectivity source. Rather than each wiring its own NetInfo listener, they
// consume the one detector returned by getOnlineDetector() — a single source
// of truth. See upload-manager.ts.
const toOnline = (state: NetInfoState): boolean =>
  !!state.isConnected && state.isInternetReachable !== false

interface InternalDetector extends OnlineDetector {
  /** Real teardown — `dispose()` itself is a no-op (see getOnlineDetector). */
  _teardown(): void
}

function createOnlineDetector(): InternalDetector {
  const listeners = new Set<() => void>()
  let online = true

  const notify = () => {
    for (const listener of listeners) {
      try {
        listener()
      } catch (err) {
        console.warn(`[offline] online-detector listener error:`, err)
      }
    }
  }

  void NetInfo.fetch()
    .then((state) => {
      online = toOnline(state)
    })
    .catch(() => {})

  const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
    const next = toOnline(state)
    const cameOnline = next && !online
    online = next // update state FIRST, then notify
    if (cameOnline) notify()
  })

  const appStateSubscription = AppState.addEventListener(`change`, (next) => {
    if (next === `active`) notify()
  })

  return {
    subscribe(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    notifyOnline() {
      notify()
    },
    isOnline() {
      return online
    },
    // No-op: the detector is a shared singleton, so a consumer disposing
    // (e.g. the executor being torn down and rebuilt on project switch) must
    // NOT kill the connectivity source the other consumer still depends on.
    // Real teardown happens via disposeOnlineDetector() at sign-out.
    dispose() {},
    _teardown() {
      netInfoUnsubscribe()
      appStateSubscription.remove()
      listeners.clear()
    },
  }
}

let _detector: InternalDetector | null = null

/** Lazily-created shared connectivity detector for executor + upload manager. */
export function getOnlineDetector(): OnlineDetector {
  if (!_detector) _detector = createOnlineDetector()
  return _detector
}

/** Real teardown of the shared detector. Called at sign-out. */
export function disposeOnlineDetector(): void {
  if (!_detector) return
  _detector._teardown()
  _detector = null
}
