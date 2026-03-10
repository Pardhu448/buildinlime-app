import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Sidebar } from "../../../components/buildInlime/Sidebar";
import { NewProjectButton } from "../../../components/buildInlime/NewProjectButton";
//import { DisplayButton } from "../../../components/buildInlime/DisplayButton";
//import { FilterButton } from "../../../components/buildInlime/FilterButton";
import { ProjectsTable } from "../../../components/buildInlime/ProjectsTable";
import { projectsCollection } from '%/infrastructure/database/tanstack-db-electric/admincollections'
import { RoutePendingComponent } from "../../../components/buildInlime/RoutePendingComponent";

import { useLiveQuery } from "@tanstack/react-db"

export const Route = createFileRoute('/_authenticated/projects/')({
  component: ProjectsRoute,
  pendingComponent: RoutePendingComponent,
})

function ProjectsRoute() {
  const navigate = useNavigate()

  const { data: projectsFromDB } = useLiveQuery((q) => q.from({ projectsCollection }), [])

  const projects = (projectsFromDB ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    priority: (p.priority ?? "Low") as "High" | "Mid" | "Low",
    targetDate: p.target_date ?? "—",
    statusPercent: parseInt(p.status_percent ?? "0", 10),
  }))

  const onProjectClick = (project: { id: string; name: string }) => {
    navigate({ to: '/projects/$projectId', params: { projectId: project.id }, state: { projectName: project.name } })
  }

return (
    <div className="flex h-screen bg-white font-['Instrument_Sans',sans-serif]">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-white border-b border-[#e5d4c1] flex items-center justify-between px-6">
          <h1
            className="font-['Instrument_Sans',sans-serif] font-semibold text-[18px] text-[#1e1e1e]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Projects
          </h1>
          <NewProjectButton />
        </header>

        {/* Toolbar */}
        <div className="bg-white border-b border-[#e5d4c1] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              className="font-['Instrument_Sans',sans-serif] font-medium text-[14px] text-[#1e1e1e] pb-1 border-b-2 border-[#976623]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              All Projects
            </button>
            {/* <button
              className="font-['Instrument_Sans',sans-serif] font-medium text-[14px] text-[#717182] hover:text-[#1e1e1e] flex items-center gap-1 transition-colors"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              <Plus className="w-3 h-3" />
              New View
            </button> */}
          </div>
          {/* <div className="flex items-center gap-2">
            <DisplayButton />
            <FilterButton />
          </div> */}
        </div>

        {/* Table */}
        {projectsFromDB === undefined ? (
          <div className="flex flex-1 items-center justify-center text-[#717182]">Loading projects…</div>
        ) : (
          <ProjectsTable projects={projects} onProjectClick={onProjectClick} />
        )}
      </div>
    </div>
  );
}
