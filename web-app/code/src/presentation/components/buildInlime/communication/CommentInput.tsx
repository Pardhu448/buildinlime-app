import { useState } from "react"
import { Send } from "lucide-react"
import { useMentions  } from "./use-mentions"
import type {MentionUser} from "./use-mentions";
import { MentionDropdown } from "./MentionDropdown"
import {
  MessageAttachmentPicker,
  PendingAttachmentChips
  
} from "./MessageResourceSection"
import type {PendingAttachment} from "./MessageResourceSection";

// Re-exported for the call sites that still import the mention helpers from here.
export { mentionDisplayName, type MentionUser } from "./use-mentions"

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
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([])
  const mentions = useMentions(users)

  const canSend = !!mentions.text.trim() || pendingFiles.length > 0

  const handleSend = () => {
    if (!canSend || !onSend) return
    onSend(mentions.text.trim(), pendingFiles, mentions.mentionIds)
    mentions.reset()
    setPendingFiles([])
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentions.handleMentionEscape(e)) return
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend()
  }

  return (
    <div className="bg-card-surface border border-card-border rounded-lg p-4 relative">
      <MentionDropdown users={mentions.filteredUsers} onSelect={mentions.selectMention} size="sm" />

      <textarea
        ref={mentions.textareaRef}
        value={mentions.text}
        onChange={mentions.handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-transparent text-foreground placeholder-secondary resize-none outline-none mb-3"
        rows={rows}
      />

      <PendingAttachmentChips
        files={pendingFiles}
        onRemove={(id) => setPendingFiles((prev) => prev.filter((f) => f.id !== id))}
      />

      <div className="flex items-center justify-between">
        <MessageAttachmentPicker
          onAdd={(attachments) => setPendingFiles((prev) => [...prev, ...attachments])}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="p-1.5 hover:bg-icon-chip rounded transition-colors disabled:opacity-40"
        >
          <Send className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}
