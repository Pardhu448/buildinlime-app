import { mentionDisplayName, type MentionUser } from "./use-mentions"

const SIZES = {
  sm: { menu: "max-h-40", item: "px-3 py-2 text-sm", avatar: "w-6 h-6" },
  xs: { menu: "max-h-36", item: "px-3 py-1.5 text-xs", avatar: "w-5 h-5" },
} as const

export interface MentionDropdownProps {
  /** Already-filtered candidates. Renders nothing when empty. */
  users: MentionUser[]
  onSelect: (user: MentionUser) => void
  size?: keyof typeof SIZES
}

/** The `@mention` autocomplete popover, anchored above the textarea. */
export function MentionDropdown({ users, onSelect, size = "sm" }: MentionDropdownProps) {
  if (users.length === 0) return null
  const s = SIZES[size]
  return (
    <div
      className={`absolute bottom-full left-0 mb-1 w-full bg-white border border-card-border rounded-lg shadow-lg ${s.menu} overflow-y-auto z-10`}
    >
      {users.map((u) => (
        <button
          key={u.id}
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(u)
          }}
          className={`w-full flex items-center gap-2 ${s.item} text-foreground hover:bg-card-surface transition-colors`}
        >
          <div
            className={`${s.avatar} rounded-full bg-card-border flex items-center justify-center text-primary text-xs font-medium flex-shrink-0`}
          >
            {mentionDisplayName(u)[0].toUpperCase()}
          </div>
          <span className="truncate">{mentionDisplayName(u)}</span>
        </button>
      ))}
    </div>
  )
}
