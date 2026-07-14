import { useMemo } from "react"
import { useLiveQuery } from "@tanstack/react-db"
import { usersCollection } from "@/src/application/collections/admin"

/**
 * id → display name for every user in scope.
 *
 * `usersCollection` is bootstrapped at boot but nothing read it until now, which
 * is why the channel screen was labelling senders `User a1b2c3` (a truncated
 * uuid) — see §4 of mobileUiAndShapeBudget.md, "users is NOT dead weight".
 */
export function useUsers(): Record<string, string> {
  const { data } = useLiveQuery((q) => q.from({ usersCollection }), [])

  return useMemo(() => {
    const map: Record<string, string> = {}
    for (const u of (data ?? []) as { id: string; name?: string; email?: string }[]) {
      map[u.id] = u.name ?? u.email ?? "Unknown"
    }
    return map
  }, [data])
}
