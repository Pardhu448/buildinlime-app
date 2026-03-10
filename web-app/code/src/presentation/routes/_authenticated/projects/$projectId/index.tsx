import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus, ChevronRight } from "lucide-react";
import { Sidebar } from "../../../../components/buildInlime/Sidebar";
import { NewBuildUnitButton } from "../../../../components/buildInlime/NewBuildUnitButton";
import { DisplayButton } from "../../../../components/buildInlime/DisplayButton";
import { FilterButton } from "../../../../components/buildInlime/FilterButton";

import { BuildUnitsTable } from "../../../../components/buildInlime/BuildUnitsTable";
import { projectsCollection, buildUnitsCollection } from '%/infrastructure/database/tanstack-db-electric/admincollections'
import { RoutePendingComponent } from "../../../../components/buildInlime/RoutePendingComponent";

import { useLiveQuery, eq } from "@tanstack/react-db"

export const Route = createFileRoute('/_authenticated/projects/$projectId/')({
  component: ProjectRoute,
  pendingComponent: RoutePendingComponent,
})

function ProjectRoute() {
  const { projectId } = Route.useParams()
  const navigate = useNavigate()

  const { data: dbProjects } = useLiveQuery(
    (q) =>
      q
        .from({ projectsCollection })
        .where(({ projectsCollection: p }) => eq(p.id, projectId)),
    [projectId]
  )

  const projectName = dbProjects?.[0]?.name ?? "Project"

  const { data: buildUnitsFromDB } = useLiveQuery(
    (q) =>
      q
        .from({ buildUnitsCollection })
        .where(({ buildUnitsCollection: bu }) => eq(bu.project_id, projectId)),
    [projectId]
  )

  const buildunits = (buildUnitsFromDB ?? []).map((bu) => ({
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
  }));

  const onBuildUnitClick = (buildUnit: { id: string; name: string, desc: string }) => {
    navigate({
      to: '/projects/$projectId/$buildUnitName',
      params: { projectId, buildUnitName: buildUnit.name },
      state: { buildUnitId: buildUnit.id, unitDescription: buildUnit.desc, projectName },
    })
  }

return (
    <div className="flex h-screen bg-white font-['Instrument_Sans',sans-serif]">
      {/* Sidebar */}
      <Sidebar projectId={projectId} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-white border-b border-[#e5d4c1] flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Link
              to="/projects"
              className="font-['Instrument_Sans',sans-serif] font-medium text-[14px] text-[#717182] hover:text-[#1e1e1e]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Projects
            </Link>
            <ChevronRight className="w-4 h-4 text-[#717182]" />
            <span
              className="font-['Instrument_Sans',sans-serif] font-semibold text-[18px] text-[#1e1e1e]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {projectName}
            </span>
          </div>
          <NewBuildUnitButton />
        </header>

        {/* Toolbar */}
        <div className="bg-white border-b border-[#e5d4c1] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              className="font-['Instrument_Sans',sans-serif] font-medium text-[14px] text-[#1e1e1e] pb-1 border-b-2 border-[#976623]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              All Build Units
            </button>
            <button
              className="font-['Instrument_Sans',sans-serif] font-medium text-[14px] text-[#717182] hover:text-[#1e1e1e] flex items-center gap-1 transition-colors"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              <Plus className="w-3 h-3" />
              New View
            </button>
          </div>
          <div className="flex items-center gap-2">
            <DisplayButton />
            <FilterButton />
          </div>
        </div>

        {/* Table */}
        <BuildUnitsTable buildUnits={buildunits} onBuildUnitClick={onBuildUnitClick} />
      </div>
    </div>
  );
}
