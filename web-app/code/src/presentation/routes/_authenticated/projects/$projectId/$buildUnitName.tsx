import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useLiveQuery, eq } from '@tanstack/react-db'
import { buildUnitsCollection, projectsCollection } from '%/infrastructure/database/tanstack-db-electric/admincollections'
import { BuildUnitContextProvider } from '../../../../contexts/route-contexts'

export const Route = createFileRoute('/_authenticated/projects/$projectId/$buildUnitName')({
  component: BuildUnitLayout,
})

function BuildUnitLayout() {
  const { projectId, buildUnitName } = Route.useParams()
  const [syncTimedOut, setSyncTimedOut] = useState(false)

  useEffect(() => {
    setSyncTimedOut(false)
    const t = setTimeout(() => setSyncTimedOut(true), 5000)
    return () => clearTimeout(t)
  }, [projectId, buildUnitName])

  const { data: dbProject } = useLiveQuery(
    (q) => q.from({ projectsCollection }).where(({ projectsCollection: p }) => eq(p.id, projectId)),
    [projectId]
  )

  const { data: dbBuildUnits } = useLiveQuery(
    (q) => q.from({ buildUnitsCollection }).where(({ buildUnitsCollection: bu }) => eq(bu.project_id, projectId)),
    [projectId]
  )

  if (dbBuildUnits === undefined) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>
  }

  const buildUnit = dbBuildUnits.find((bu) => bu.name === buildUnitName)

  if (!buildUnit) {
    if (!syncTimedOut) {
      return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>
    }
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Build unit "{buildUnitName}" not found.
      </div>
    )
  }

  return (
    <BuildUnitContextProvider value={{
      buildUnitId: buildUnit.id,
      buildUnitDesc: buildUnit.description ?? '',
      projectName: dbProject?.[0]?.name ?? 'Project',
    }}>
      <Outlet />
    </BuildUnitContextProvider>
  )
}
