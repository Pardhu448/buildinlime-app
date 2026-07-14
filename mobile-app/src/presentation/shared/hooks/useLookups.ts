import { useMemo } from "react"
import { useLiveQuery } from "@tanstack/react-db"
import { usersCollection } from "@/src/application/collections/admin"
import {
  buildUnitsCollection,
  channelsCollection,
  projectsCollection,
} from "@/src/application/collections/organization"
import type { BuildUnit, Channel, Project } from "@buildinlime/domain-types"

/**
 * Id → name lookups for the cross-cutting screens (Inbox, My Tasks), which show
 * rows from every channel and so cannot resolve their own context locally.
 *
 * NOTE: this reads `users` and `channels`, which the shape budget scopes to the
 * channel screen. That is the debt recorded in §4 of `mobileUiAndShapeBudget.md`
 * — the `mentions` shape denormalizes these names into the row and this hook
 * should fall away for the Inbox when it lands. Only mount this under a selected
 * project: the scoped collections are null until `initProjectCollections` runs.
 */
export function useLookups() {
  const { data: users } = useLiveQuery((q) => q.from({ usersCollection }), [])
  const { data: channels } = useLiveQuery((q) => q.from({ channelsCollection }), [])
  const { data: buildUnits } = useLiveQuery((q) => q.from({ buildUnitsCollection }), [])
  const { data: projects } = useLiveQuery((q) => q.from({ projectsCollection }), [])

  return useMemo(() => {
    const userNames = new Map<string, string>()
    for (const u of (users ?? []) as { id: string; name?: string; email?: string }[]) {
      userNames.set(u.id, u.name ?? u.email ?? "Unknown")
    }
    const channelsById = new Map((channels ?? []).map((c) => [c.id, c as Channel]))
    const buildUnitsById = new Map((buildUnits ?? []).map((b) => [b.id, b as BuildUnit]))
    const projectsById = new Map((projects ?? []).map((p) => [p.id, p as Project]))

    return {
      getUserName: (id?: string | null) =>
        (id && userNames.get(id)) || "Unknown",
      getChannel: (id?: string | null) => (id ? channelsById.get(id) : undefined),
      getBuildUnit: (id?: string | null) => (id ? buildUnitsById.get(id) : undefined),
      getProject: (id?: string | null) => (id ? projectsById.get(id) : undefined),
    }
  }, [users, channels, buildUnits, projects])
}
