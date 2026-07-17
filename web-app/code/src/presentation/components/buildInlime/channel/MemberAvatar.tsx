import { userInitial, type ChannelUser } from "./types"

/** The small circular avatar with a user's initial, used across the channel panels. */
export function MemberAvatar({ user }: { user: ChannelUser }) {
  return (
    <div className="w-6 h-6 rounded-full bg-card-border flex items-center justify-center text-primary text-xs font-medium flex-shrink-0">
      {userInitial(user)}
    </div>
  )
}
