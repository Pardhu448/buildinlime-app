/** The minimal user shape the channel sub-panels render (avatar + name/email). */
export type ChannelUser = { id: string; name?: string | null; email?: string | null }

/** Avatar initial: first char of name, else email, else "?". */
export function userInitial(user: ChannelUser) {
  return ((user.name || user.email || "?")[0] ?? "?").toUpperCase()
}

/** Display name: name if present, else email. */
export function userLabel(user: ChannelUser) {
  return user.name || user.email
}
