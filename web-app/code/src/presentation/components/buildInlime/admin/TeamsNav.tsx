import { ChevronDown, ChevronRight, Plus } from "lucide-react"
import { TeamSection } from "./TeamSection"
import type { SidebarTeam, SidebarUser } from "./sidebar-types"

export interface TeamsNavProps {
  expanded: boolean
  onToggle: () => void
  onCreate: () => void
  teams: SidebarTeam[]
  allUsers: SidebarUser[]
  onAddMember: (teamId: string, newMemberIds: string[]) => Promise<void>
}

/** The "Teams" section (only shown to a project owner inside a project): a
 *  create button plus one expandable TeamSection per team. */
export function TeamsNav({ expanded, onToggle, onCreate, teams, allUsers, onAddMember }: TeamsNavProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-1 px-2 py-1 mb-1">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex-1"
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          <span>Teams</span>
        </button>
        <button
          onClick={onCreate}
          className="p-0.5 text-muted-foreground hover:text-primary hover:bg-icon-chip rounded transition-colors"
          title="Create team"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="space-y-1">
          {teams.length === 0 ? (
            <p className="px-3 py-1 text-xs text-muted-foreground">No teams yet</p>
          ) : (
            teams.map((team) => {
              const members = allUsers
                .filter((u) => team.member_ids.includes(u.id))
                .map((u) => ({ id: u.id, name: u.name ?? "", email: u.email }));
              return (
                <TeamSection
                  key={team.id}
                  teamId={team.id}
                  name={team.name}
                  description={team.description}
                  members={members}
                  currentMemberIds={team.member_ids}
                  allUsers={allUsers}
                  onAddMember={onAddMember}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  )
}
