import { ChevronDown, ChevronRight, Hash } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { unwrapJsonb } from "%/presentation/lib/utils"
import type { SidebarBuildUnit, SidebarChannel } from "./sidebar-types"

export interface BuildUnitsNavProps {
  projectId: string
  expanded: boolean
  onToggle: () => void
  buildUnits: SidebarBuildUnit[]
  channelsFor: (buildUnitId: string) => SidebarChannel[]
  expandedBuIds: Record<string, boolean>
  onToggleBu: (buildUnitId: string) => void
}

/** The "Build Units" tree (only shown inside a project): each build unit expands
 *  to its channels. */
export function BuildUnitsNav({
  projectId,
  expanded,
  onToggle,
  buildUnits,
  channelsFor,
  expandedBuIds,
  onToggleBu,
}: BuildUnitsNavProps) {
  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-1"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <span>Build Units</span>
      </button>

      {expanded && (
        <div className="space-y-0.5">
          {buildUnits.length === 0 ? (
            <p className="px-4 py-1 text-xs text-muted-foreground">No build units</p>
          ) : (
            buildUnits.map((bu) => {
              const buExpanded = expandedBuIds[bu.id] ?? false;
              const channels = channelsFor(bu.id);
              return (
                <div key={bu.id}>
                  {/* Build Unit row */}
                  <div className="group flex items-center gap-1 rounded hover:bg-icon-chip transition-colors">
                    <button
                      onClick={() => onToggleBu(bu.id)}
                      className="p-1 flex-shrink-0 text-muted-foreground"
                    >
                      {buExpanded ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                    </button>
                    <Link
                      to="/projects/$projectId/$buildUnitName"
                      params={{ projectId, buildUnitName: bu.name }}
                      className="flex-1 py-1.5 pr-2 text-sm text-foreground truncate"
                    >
                      {bu.name}
                    </Link>
                  </div>

                  {/* Channels nested under build unit */}
                  {buExpanded && (
                    <div className="ml-5 space-y-0.5 mt-0.5">
                      {channels.length === 0 ? (
                        <p className="px-3 py-1 text-xs text-muted-foreground">No channels</p>
                      ) : (
                        channels.map((ch) => {
                          const channelName = unwrapJsonb(ch.name);
                          return (
                            <Link
                              key={ch.id}
                              to="/projects/$projectId/$buildUnitName/$channelName/"
                              params={{ projectId, buildUnitName: bu.name, channelName }}
                              className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-icon-chip rounded transition-colors"
                            >
                              <Hash className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate flex-1">
                                {channelName}
                              </span>
                            </Link>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  )
}
