import { startOfflineExecutor } from "@tanstack/offline-transactions/react-native"
import type { OfflineExecutor } from "@tanstack/offline-transactions"
import {
  tasksCollection,
  messagesCollection,
  resourcesCollection,
  propertiesCollection,
  seenStateCollection,
} from "../../application/collections/communication"
import { mutationFns } from "./mutation-fns"
import { sqliteStorageAdapter } from "./storage"
import { getOnlineDetector } from "./online-detector"

// NOTE: this module deliberately does NOT import the actions barrel, since
// each action module imports `getOfflineExecutor` from here — pulling the
// barrel in would create a circular dep that Metro evaluates as a TDZ crash
// at app startup. Callers (layout / sign-out) are responsible for invoking
// `resetAllOfflineActions()` before/after init/dispose as needed.

let _executor: OfflineExecutor | null = null

// Start (or restart) the offline executor with the currently-initialized
// collections. It captures collection instances BY VALUE, so it must be called
// AFTER initProjectCollections() and re-called whenever those instances are
// rebuilt.
//
// In practice that means once at startup, and again after a membership RESYNC
// (see resyncProjectCollections + its caller in (tabs)/_layout). Not on a
// project switch — there isn't one; switching projects means signing out.
export async function initOfflineExecutor(): Promise<OfflineExecutor> {
  if (_executor) {
    _executor.dispose()
    _executor = null
  }
  const executor = startOfflineExecutor({
    // Only the collections mobile actually writes through the outbox. Projects,
    // build units and channels are web-only creations — mobile reads them but
    // drives no mutations against them. Teams are web-only outright: mobile
    // neither reads nor writes them, so it syncs no teams collection at all.
    collections: {
      tasks: tasksCollection,
      messages: messagesCollection,
      resources: resourcesCollection,
      properties: propertiesCollection,
      seenState: seenStateCollection,
    },
    mutationFns,
    storage: sqliteStorageAdapter,
    // Custom detector — the built-in ReactNativeOnlineDetector notifies the
    // executor before updating its online flag, so offline-queued transactions
    // never drain on reconnect. Shared singleton with the upload manager; see
    // online-detector.ts.
    onlineDetector: getOnlineDetector(),
  })
  await executor.waitForInit()
  _executor = executor
  if (__DEV__) {
    const pending = await executor.peekOutbox()
    console.log(`[offline] Executor ready, ${pending.length} pending tx(s) restored`)
  }
  return executor
}

export function getOfflineExecutor(): OfflineExecutor {
  if (!_executor) {
    throw new Error(
      `[offline] Executor accessed before initOfflineExecutor() completed`,
    )
  }
  return _executor
}

export function disposeOfflineExecutor(): void {
  if (!_executor) return
  _executor.dispose()
  _executor = null
}
