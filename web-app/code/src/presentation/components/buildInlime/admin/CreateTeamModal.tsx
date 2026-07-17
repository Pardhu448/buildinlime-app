import type { FormEvent } from "react"
import { Modal } from "../shared/Modal"
import type { SidebarUser } from "./sidebar-types"

export interface CreateTeamModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (e: FormEvent) => void
  teamName: string
  setTeamName: (name: string) => void
  teamDesc: string
  setTeamDesc: (desc: string) => void
  users: SidebarUser[]
  currentUserId: string
  selectedMemberIds: string[]
  toggleMember: (userId: string) => void
  isSubmitting: boolean
}

/** The "Create Team" modal: name, description, and a member checklist (the
 *  creator is always included and cannot be unchecked). */
export function CreateTeamModal({
  open,
  onClose,
  onSubmit,
  teamName,
  setTeamName,
  teamDesc,
  setTeamDesc,
  users,
  currentUserId,
  selectedMemberIds,
  toggleMember,
  isSubmitting,
}: CreateTeamModalProps) {
  return (
    <Modal open={open} onClose={onClose}>
      {/* Own heading rather than Modal's `title` — this dialog uses the
          smaller text-lg/foreground style, not the standard text-xl/gray-800. */}
      <h2 className="text-lg font-semibold text-foreground mb-5">Create Team</h2>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Team Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g. Masonry Team"
            required
            autoFocus
            className="w-full px-3 py-2 border border-card-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Description</label>
          <textarea
            value={teamDesc}
            onChange={(e) => setTeamDesc(e.target.value)}
            placeholder="What does this team work on?"
            rows={2}
            className="w-full px-3 py-2 border border-card-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Members</label>
          <div className="max-h-48 overflow-y-auto border border-card-border rounded-md divide-y divide-icon-chip">
            {users.map((user) => {
              const isCreator = user.id === currentUserId;
              const checked = selectedMemberIds.includes(user.id);
              return (
                <label
                  key={user.id}
                  className={`flex items-center gap-3 px-3 py-2 hover:bg-card-surface transition-colors ${
                    isCreator ? "opacity-70 cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isCreator}
                    onChange={() => toggleMember(user.id)}
                    className="accent-primary"
                  />
                  <div className="w-6 h-6 rounded-full bg-card-border flex items-center justify-center text-primary text-xs font-medium flex-shrink-0">
                    {((user.name || user.email || "?")[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate">{user.name || user.email}</p>
                    {user.name && (
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    )}
                  </div>
                  {isCreator && (
                    <span className="text-xs text-secondary">you</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !teamName.trim()}
          className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {isSubmitting ? "Creating…" : "Create Team"}
        </button>
      </form>
    </Modal>
  )
}
