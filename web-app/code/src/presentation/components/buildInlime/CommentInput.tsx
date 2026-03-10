import { useState, useRef } from "react"
import { Send } from "lucide-react"
import {
  MessageAttachmentPicker,
  PendingAttachmentChips,
  type PendingAttachment,
} from "./MessageResourceSection"

export type MentionUser = { id: string; name?: string | null; email?: string | null }

export function mentionDisplayName(u: MentionUser) {
  return u.name?.trim() || u.email?.trim() || "Unknown"
}

export interface CommentInputProps {
  placeholder?: string
  rows?: number
  users?: MentionUser[]
  onSend?: (text: string, files: PendingAttachment[], mentionIds: string[]) => void
}

export function CommentInput({
  placeholder = "Leave a comment...",
  rows = 3,
  users = [],
  onSend,
}: CommentInputProps) {
  const [text, setText] = useState("")
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIds, setMentionIds] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canSend = !!text.trim() || pendingFiles.length > 0

  const filteredUsers =
    mentionQuery !== null
      ? users.filter((u) =>
          mentionDisplayName(u).toLowerCase().includes(mentionQuery.toLowerCase())
        )
      : []

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    setText(newText)
    const cursorPos = e.target.selectionStart ?? newText.length
    const textBeforeCursor = newText.slice(0, cursorPos)
    const match = textBeforeCursor.match(/@(\w*)$/)
    setMentionQuery(match ? match[1] : null)
  }

  const handleSelectMention = (user: MentionUser) => {
    const name = mentionDisplayName(user)
    const cursorPos = textareaRef.current?.selectionStart ?? text.length
    const before = text.slice(0, cursorPos).replace(/@\w*$/, `@${name} `)
    setText(before + text.slice(cursorPos))
    setMentionIds((prev) => (prev.includes(user.id) ? prev : [...prev, user.id]))
    setMentionQuery(null)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const handleSend = () => {
    if (!canSend || !onSend) return
    onSend(text.trim(), pendingFiles, mentionIds)
    setText("")
    setPendingFiles([])
    setMentionIds([])
    setMentionQuery(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && e.key === "Escape") {
      e.preventDefault()
      setMentionQuery(null)
      return
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend()
  }

  return (
    <div className="bg-[#fdf8f2] border border-[#e5d4c1] rounded-lg p-4 relative">
      {/* Mention dropdown */}
      {mentionQuery !== null && filteredUsers.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-full bg-white border border-[#e5d4c1] rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
          {filteredUsers.map((u) => (
            <button
              key={u.id}
              onMouseDown={(e) => { e.preventDefault(); handleSelectMention(u) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1e1e1e] hover:bg-[#fdf8f2] transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-[#e5d4c1] flex items-center justify-center text-[#976623] text-xs font-medium flex-shrink-0">
                {mentionDisplayName(u)[0].toUpperCase()}
              </div>
              <span className="truncate">{mentionDisplayName(u)}</span>
            </button>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-transparent text-[#1e1e1e] placeholder-[#ac7f5e] resize-none outline-none mb-3"
        rows={rows}
      />

      <PendingAttachmentChips
        files={pendingFiles}
        onRemove={(id) => setPendingFiles((prev) => prev.filter((f) => f.id !== id))}
      />

      <div className="flex items-center justify-between">
        <MessageAttachmentPicker
          onAdd={(attachments) =>
            setPendingFiles((prev) => [...prev, ...attachments])
          }
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="p-1.5 hover:bg-[#f0e5d8] rounded transition-colors disabled:opacity-40"
        >
          <Send className="w-4 h-4 text-[#717182]" />
        </button>
      </div>
    </div>
  )
}
