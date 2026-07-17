import { MemberAvatar } from "./MemberAvatar"
import { userLabel, type ChannelUser } from "./types"

export interface ChannelMembersListProps {
  members: ChannelUser[]
  isOwner: boolean
  channelOwnerId: string | undefined
  confirmRemoveId: string | null
  setConfirmRemoveId: (id: string | null) => void
  onRemoveMember: (userId: string, userName: string) => void
}

/** The right-panel Members list, with the inline "remove member" confirmation. */
export function ChannelMembersList({
  members,
  isOwner,
  channelOwnerId,
  confirmRemoveId,
  setConfirmRemoveId,
  onRemoveMember,
}: ChannelMembersListProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">Members</p>
      {members.length === 0 ? (
        <p className="text-xs text-muted-foreground">No members yet.</p>
      ) : (
        <div className="space-y-2">
          {members.map((u) => (
            <div key={u.id}>
              {confirmRemoveId === u.id ? (
                <div className="text-xs bg-red-50 border border-red-200 rounded p-2">
                  <p className="text-red-700 mb-2">Remove <strong>{userLabel(u)}</strong>?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onRemoveMember(u.id, userLabel(u) || u.id)}
                      className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                    >Confirm</button>
                    <button
                      onClick={() => setConfirmRemoveId(null)}
                      className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50"
                    >Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <MemberAvatar user={u} />
                    <span className="text-sm text-foreground truncate">{userLabel(u)}</span>
                  </div>
                  {isOwner && u.id !== channelOwnerId && (
                    <button
                      onClick={() => setConfirmRemoveId(u.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs transition-opacity"
                      title="Remove member"
                    >✕</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
