import type { OfflineExecutor } from "@tanstack/offline-transactions"

// The platform primitives each app injects into the shared action factories.
//
// getExecutor / getCollection are GETTERS, not values, on purpose: web rebuilds
// its collections (a reassigned module `let`) and its executor on resync /
// project switch, and the memoized actions are reset to rebind. Reading through a
// getter means the factory always targets the CURRENT instance, never a stale one.
export type { OfflineExecutor }

// Minimal structural view of a TanStack DB collection's optimistic write API.
// Deliberately loose on the update draft (Record<string, unknown>) — matching how
// the action onMutate handlers already type it — so any app collection satisfies
// it without sync-core depending on the concrete row types.
export interface OptimisticCollection<TInsert> {
  get(key: string): unknown
  insert(row: TInsert): unknown
  update(id: string, updater: (draft: Record<string, unknown>) => void): unknown
  delete(id: string): unknown
}
