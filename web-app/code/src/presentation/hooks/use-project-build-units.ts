import { useCallback, useEffect, useRef } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { projectsCollection, buildUnitsCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { usePendingBuildUnits } from "./use-pending-build-units"

export function useProjectBuildUnits(projectId: string) {
  const navigate = useNavigate()
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
    description: bu.descritption,
    health: (bu.health ?? "On track") as "On track" | "At risk" | "Off track",
    priority: (bu.priority ?? "Low") as "High" | "Mid" | "Low",
    waitingOnTask: {
      name: bu.task_name ?? "—",
      assignee: bu.task_assignee ?? "—",
      since: bu.task_since ?? "—",
    },
    targetDate: bu.target_date ?? "—",
    statusPercent: parseInt(bu.status_percent ?? "0", 10),
  }))

  // Ghost rows: keep pending items visible during Electric txid reconciliation
  const dbIds = new Set(dbBuildUnits.map((bu) => bu.id))
  const ghostRows = [...pendingItems.values()]
    .filter((p) => !dbIds.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      health: "On track" as const,
      priority: "Low" as const,
      waitingOnTask: { name: "—", assignee: "—", since: "—" },
      targetDate: "—",
      statusPercent: 0,
    }))

  const buildUnits = [...dbBuildUnits, ...ghostRows]

  const onBuildUnitClick = (buildUnit: { id: string; name: string; desc: string }) => {
    navigate({
      to: "/projects/$projectId/$buildUnitName",
      params: { projectId, buildUnitName: buildUnit.name },
      state: { buildUnitId: buildUnit.id, unitDescription: buildUnit.desc, projectName },
    })
  }

  return {
    projectName,
    buildUnits,
    pendingIds,
    addPending,
    removePending,
    onTrpcComplete,
    onBuildUnitClick,
  }
}
