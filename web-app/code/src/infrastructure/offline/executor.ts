import { startOfflineExecutor } from "@tanstack/offline-transactions"
import type { OfflineExecutor } from "@tanstack/offline-transactions"
import {
  tasksCollection,
  messagesCollection,
  resourcesCollection,
  propertiesCollection,
} from "%/application/collections/communication"
import {
  projectsCollection,
  buildUnitsCollection,
  channelsCollection,
} from "%/application/collections/organization"
import { teamsCollection } from "%/application/collections/admin"
import { mutationFns } from "./mutation-fns"

let _executor: OfflineExecutor | null = null

export async function initOfflineExecutor(): Promise<OfflineExecutor> {
  if (_executor) return _executor
  const executor = startOfflineExecutor({
    collections: {
      tasks: tasksCollection,
      projects: projectsCollection,
      messages: messagesCollection,
      resources: resourcesCollection,
      properties: propertiesCollection,
      teams: teamsCollection,
      buildUnits: buildUnitsCollection,
      channels: channelsCollection,
    },
    mutationFns,
  })
  await executor.waitForInit()
  _executor = executor
  if (import.meta.env.DEV) {
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
