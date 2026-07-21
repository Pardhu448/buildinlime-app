import { useCallback, useEffect, useRef } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useLiveQuery, eq, inArray } from "@tanstack/react-db"
import { projectsCollection, buildUnitsCollection, propertiesCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { useSession } from "%/infrastructure/auth/client"
import { mapPropertyRow } from "%/presentation/lib/utils"
import type { Property } from "%/domain/communication/types"
import { usePendingBuildUnits } from "./use-pending-build-units"

export function useProjectBuildUnits(projectId: string) {
  const navigate = useNavigate()
  const { data: session } = useSession()
  const { pendingItems, pendingIds, addPending, removePending } = usePendingBuildUnits()

  const pendingIdsRef = useRef(pendingIds)
  pendingIdsRef.current = pendingIds
  const trpcDoneRef = useRef<Set<string>>(new Set())

  const onTrpcComplete = useCallback((id: string) => {
    trpcDoneRef.current.add(id)
  }, [])

  const { data: dbProjects } = useLiveQuery(
    (q) => q.from({ projectsCollection }).where(({ projectsCollection: p }) => eq(p.id, projectId)),
    [projectId]
  )

  const { data: buildUnitsFromDB } = useLiveQuery(
    (q) => q.from({ buildUnitsCollection }).where(({ buildUnitsCollection: bu }) => eq(bu.project_id, projectId)),
    [projectId]
  )

  // Live properties for every build unit in the project. Grouped by entity_id
  // below so each build unit renders its own status/priority/target/… pills
  // instead of the stale columns that used to live on the build_units row.
  const buildUnitIds = (buildUnitsFromDB ?? []).map((bu) => bu.id)
  const { data: buildUnitProperties } = useLiveQuery(
    (q) => q.from({ propertiesCollection }).where(({ propertiesCollection: p }) => inArray(p.entity_id, buildUnitIds)),
    [buildUnitIds.join(`,`)]
  )

  const propertiesByEntity = new Map<string, Property[]>()
  for (const p of buildUnitProperties ?? []) {
    const property = mapPropertyRow(p)
    const list = propertiesByEntity.get(property.entity_id) ?? []
    list.push(property)
    propertiesByEntity.set(property.entity_id, list)
  }

  // Two-signal: stop spinner only when both tRPC is done AND Electric confirms the write
  useEffect(() => {
    if (!buildUnitsFromDB) return
    for (const id of pendingIdsRef.current) {
      if (trpcDoneRef.current.has(id) && buildUnitsFromDB.some((bu) => bu.id === id)) {
        removePending(id)
        trpcDoneRef.current.delete(id)
      }
    }
  }, [buildUnitsFromDB])

  const projectName = dbProjects?.[0]?.name ?? "Project"

  const dbBuildUnits = (buildUnitsFromDB ?? []).map((bu) => ({
    id: bu.id,
    name: bu.name,
    description: bu.description,
    properties: propertiesByEntity.get(bu.id) ?? [],
    health: (bu.health ?? "On track"),
    priority: (bu.priority ?? "Low"),
    waitingOnTask: {
      name: bu.task_name ?? "—",
      assignee: bu.task_assignee ?? "—",
      since: bu.task_since ?? "—",
    },
    targetDate: bu.target_date ?? "—",
    statusPercent: parseInt(bu.status_percent ?? "0", 10),
    // Owner-only delete. The server enforces it (buildUnits.delete returns
    // NOT_FOUND otherwise); hiding the trash button is courtesy.
    canDelete: !!session?.user && bu.owner_id === session.user.id,
  }))

  // Ghost rows: keep pending items visible during Electric txid reconciliation
  const dbIds = new Set(dbBuildUnits.map((bu) => bu.id))
  const ghostRows = [...pendingItems.values()]
    .filter((p) => !dbIds.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      properties: [] as Property[],
      health: "On track" as const,
      priority: "Low" as const,
      waitingOnTask: { name: "—", assignee: "—", since: "—" },
      targetDate: "—",
      statusPercent: 0,
      // A ghost row is still reconciling its create — never offer to delete it.
      canDelete: false,
    }))

  const buildUnits = [...dbBuildUnits, ...ghostRows]

  // Takes only what it reads. It previously declared `desc`, a field the build
  // unit rows do not have (they carry `description`), so no caller's object was
  // ever assignable — invisible while the rows were untyped.
  const onBuildUnitClick = (buildUnit: { name: string }) => {
    // No `state` payload: nothing in the app reads router/history state, and
    // these three keys were never consumed anywhere. The destination re-derives
    // what it needs from the URL params and its own live queries.
    navigate({
      to: "/projects/$projectId/$buildUnitName",
      params: { projectId, buildUnitName: buildUnit.name },
    })
  }

  // Soft delete, owner-only. The build unit and its channels/tasks/resources fall
  // out of their Electric shapes — the server cascades the soft-delete in one
  // transaction (buildUnits.delete). The collection.delete triggers onDelete →
  // trpc.buildUnits.delete. Confirmation is the page's job (ConfirmDeleteModal);
  // this is the raw action run once the user confirms.
  const deleteBuildUnit = (id: string) => {
    buildUnitsCollection.delete(id)
  }

  return {
    projectName,
    buildUnits,
    pendingIds,
    addPending,
    removePending,
    onTrpcComplete,
    onBuildUnitClick,
    deleteBuildUnit,
  }
}
