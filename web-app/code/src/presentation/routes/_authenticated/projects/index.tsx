import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Sidebar } from "../../../components/buildInlime";
import { NewProjectButton } from "../../../components/buildInlime";
//import { DisplayButton } from "../../../components/buildInlime";
//import { FilterButton } from "../../../components/buildInlime";
import { ProjectsTable } from "../../../components/buildInlime";
import { projectsCollection, usersCollection } from '%/infrastructure/database/tanstack-db-electric/admincollections'
import { RoutePendingComponent } from "../../../components/buildInlime";

import { useLiveQuery } from "@tanstack/react-db"

export const Route = createFileRoute('/_authenticated/projects/')({
  component: ProjectsRoute,
  pendingComponent: RoutePendingComponent,
})

function ProjectsRoute() {
  const navigate = useNavigate()

  const { data: projectsFromDB } = useLiveQuery((q) => q.from({ projectsCollection }), [])
  const { data: usersFromDB } = useLiveQuery((q) => q.from({ usersCollection }), [])

  // FUTURE WORK: a project has no roll-up metrics of its own. Health, target date
  // and % complete should be *derived* by a custom analytics function that
  // aggregates the real property data of the project's build units and channels
  // (e.g. roll their statuses into a project health, average % complete, take the
  // nearest target date). Until that exists we show concrete facts off the project
  // row — who created it and when — rather than placeholder metrics. See the
  // build-units table + channel cards, which already read live property data via
  // use-project-build-units / use-build-unit-channels.
  const projects = (projectsFromDB ?? []).map((p) => {
    const creator = (usersFromDB ?? []).find((u) => u.id === p.owner_id)
    return {
      id: p.id,
      name: p.name,
      createdBy: creator?.name || creator?.email || "Unknown",
      createdAt: p.created_at ? new Date(p.created_at as string | Date).toLocaleDateString() : "—",
    }
  })

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
        <header className="h-14 bg-white border-b border-card-border flex items-center justify-between px-6">
          <h1
            className="font-['Instrument_Sans',sans-serif] font-semibold text-[18px] text-[#1e1e1e]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Projects
          </h1>
          <NewProjectButton />
        </header>

        {/* Toolbar */}
        <div className="bg-white border-b border-card-border px-6 py-3 flex items-center justify-between">
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
