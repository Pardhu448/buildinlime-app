import { useState, useRef } from "react"

export type MentionUser = { id: string; name?: string | null; email?: string | null }

export function mentionDisplayName(u: MentionUser) {
  return u.name?.trim() || u.email?.trim() || "Unknown"
}

/**
 * The `@mention` composer state machine shared by the top-level comment box and
 * every nested reply box. It owns the textarea text, the in-progress mention
 * query (the token after the last unmatched `@`), the accumulated mention ids,
 * and the textarea ref used to reposition the caret after a pick.
 *
 * It deliberately does NOT own the "send" or plain-Escape behaviour — those
 * differ per consumer (a reply box also closes itself on Escape) — so it exposes
 * `handleMentionEscape`, which the consumer calls first from its own keydown
 * handler and early-returns on when it reports the event consumed.
 */
export function useMentions(users: MentionUser[]) {
  const [text, setText] = useState("")
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIds, setMentionIds] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const filteredUsers =
    mentionQuery !== null
      ? users.filter((u) =>
          mentionDisplayName(u).toLowerCase().includes(mentionQuery.toLowerCase())
        )
      : []

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    setText(newText)
    const cursorPos = e.target.selectionStart ?? newText.length
    const match = newText.slice(0, cursorPos).match(/@(\w*)$/)
    setMentionQuery(match ? match[1] : null)
  }

  const selectMention = (user: MentionUser) => {
    const name = mentionDisplayName(user)
    const cursorPos = textareaRef.current?.selectionStart ?? text.length
    const before = text.slice(0, cursorPos).replace(/@\w*$/, `@${name} `)
    setText(before + text.slice(cursorPos))
    setMentionIds((prev) => (prev.includes(user.id) ? prev : [...prev, user.id]))
    setMentionQuery(null)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const reset = () => {
    setText("")
    setMentionIds([])
    setMentionQuery(null)
  }

  /** Closes the mention dropdown on Escape. Returns true if it consumed the event. */
  const handleMentionEscape = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && e.key === "Escape") {
      e.preventDefault()
      setMentionQuery(null)
      return true
    }
    return false
  }

  return {
    text,
    setText,
    mentionIds,
    textareaRef,
    filteredUsers,
    handleTextChange,
    selectMention,
    reset,
    handleMentionEscape,
  }
}
