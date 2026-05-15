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
const toOnline = (state: NetInfoState): boolean =>
  !!state.isConnected && state.isInternetReachable !== false

export function createOnlineDetector(): OnlineDetector {
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
    dispose() {
      netInfoUnsubscribe()
      appStateSubscription.remove()
      listeners.clear()
    },
  }
}
