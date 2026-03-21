import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus, ChevronRight } from "lucide-react";
import { Sidebar } from "../../../../components/buildInlime";
import { NewBuildUnitButton } from "../../../../components/buildInlime";
import { DisplayButton } from "../../../../components/buildInlime";
import { FilterButton } from "../../../../components/buildInlime";
import { BuildUnitsTable } from "../../../../components/buildInlime";
import { RoutePendingComponent } from "../../../../components/buildInlime";
import { useProjectBuildUnits } from "../../../../hooks/use-project-build-units";

export const Route = createFileRoute('/_authenticated/projects/$projectId/')({
  component: ProjectRoute,
  pendingComponent: RoutePendingComponent,
})

function ProjectRoute() {
  const { projectId } = Route.useParams()
  const { projectName, buildUnits, pendingIds, addPending, removePending, onTrpcComplete, onBuildUnitClick } =
    useProjectBuildUnits(projectId)

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
          <NewBuildUnitButton addPending={addPending} removePending={removePending} onTrpcComplete={onTrpcComplete} />
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
        <BuildUnitsTable buildUnits={buildUnits} onBuildUnitClick={onBuildUnitClick} pendingIds={pendingIds} />
      </div>
    </div>
  );
}
