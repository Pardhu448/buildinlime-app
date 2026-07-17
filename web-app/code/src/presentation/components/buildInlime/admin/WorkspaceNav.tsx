import { ChevronDown, ChevronRight, FolderOpen } from "lucide-react"
import { Link } from "@tanstack/react-router"
import type { SidebarProject } from "./sidebar-types"

export interface WorkspaceNavProps {
  expanded: boolean
  onToggle: () => void
  projects: SidebarProject[]
}

/** The always-visible "Workspace" section: All Projects + one link per project. */
export function WorkspaceNav({ expanded, onToggle, projects }: WorkspaceNavProps) {
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
        <span>Workspace</span>
      </button>

      {expanded && (
        <div className="space-y-0.5">
          {/* All Projects link */}
          <Link
            to="/projects"
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-icon-chip rounded transition-colors"
          >
            <FolderOpen className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="font-medium">All Projects</span>
          </Link>

          {/* Individual project links */}
          {projects.map((p) => (
            <Link
              key={p.id}
              to="/projects/$projectId"
              params={{ projectId: p.id }}
              className="w-full flex items-center gap-2 pl-7 pr-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-icon-chip rounded transition-colors"
            >
              <div className="w-4 h-4 rounded bg-card-border flex items-center justify-center flex-shrink-0">
                <span className="text-primary text-[9px] font-bold leading-none">
                  {p.name[0]?.toUpperCase()}
                </span>
              </div>
              <span className="truncate">{p.name}</span>
            </Link>
          ))}

          {projects.length === 0 && (
            <p className="px-3 py-1 text-xs text-muted-foreground">No projects yet</p>
          )}
        </div>
      )}
    </div>
  )
}
