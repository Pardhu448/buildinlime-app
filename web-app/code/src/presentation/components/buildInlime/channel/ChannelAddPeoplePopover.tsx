import { MemberAvatar } from "./MemberAvatar"
import { userLabel, type ChannelUser } from "./types"

export interface ChannelAddPeoplePopoverProps {
  open: boolean
  onClose: () => void
  nonMembers: ChannelUser[]
  isAddingMember: boolean
  onAddMember: (userId: string, onSuccess: () => void) => void
}

/** The "Add to channel" popover anchored to the Add People button. Renders inside
 *  the button's relative wrapper, so it must stay a child of that element. */
export function ChannelAddPeoplePopover({
  open,
  onClose,
  nonMembers,
  isAddingMember,
  onAddMember,
}: ChannelAddPeoplePopoverProps) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute left-24 top-0 z-20 bg-white border border-card-border rounded-lg shadow-lg min-w-[220px]">
        <p className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-card-border">
          Add to channel
        </p>
        {nonMembers.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">All users are already members.</p>
        ) : (
          <div className="py-1 max-h-48 overflow-y-auto">
            {nonMembers.map((u) => (
              <button
                key={u.id}
                onClick={() => onAddMember(u.id, onClose)}
                disabled={isAddingMember}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-card-surface transition-colors disabled:opacity-50"
              >
                <MemberAvatar user={u} />
                <span className="truncate">{userLabel(u)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
