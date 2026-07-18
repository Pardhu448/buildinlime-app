import { useState } from "react"
import { MessageCircle, ChevronDown, ChevronRight, Send, X, Trash2 } from "lucide-react"
import { deleteMessageAction } from "%/application/actions/messages"
import type { PendingResource } from "%/application/hooks/use-pending-resources"
import { useMentions  } from "./use-mentions"
import type {MentionUser} from "./use-mentions";
import { MentionDropdown } from "./MentionDropdown"
import { MessagePendingChips } from "./MessagePendingChips"
import {
  MessageResourceDisplay,
  MessageAttachmentPicker,
  PendingAttachmentChips
  
} from "./MessageResourceSection"
import type {PendingAttachment} from "./MessageResourceSection";
import { formatDateTime } from "%/presentation/lib/datetime"
import type { MessageRow } from "@buildinlime/contracts"
import { toDate } from "@buildinlime/contracts"

function displayName(user: MentionUser | undefined) {
  if (!user) return "Unknown"
  return user.name?.trim() || user.email?.trim() || "Unknown"
}

function avatarInitial(user: MentionUser | undefined) {
  return displayName(user)[0]?.toUpperCase() ?? "?"
}

export interface MessageItemProps {
  // Wire rows, not the domain `Message`: these come straight from a live query.
  message: MessageRow
  allMessages: MessageRow[]
  messagePending: PendingResource[]
  users: MentionUser[]
  onReply: (parentId: string, text: string, files: PendingAttachment[], mentionIds: string[]) => void
  onRetryUpload: (id: string) => void
  depth?: number
  focusMessageId?: string
  currentUserId: string
}

export function MessageItem({
  message,
  allMessages,
  messagePending,
  users,
  onReply,
  onRetryUpload,
  depth = 0,
  focusMessageId,
  currentUserId,
}: MessageItemProps) {
  const isFocused = focusMessageId === message.id
  const isDeleted = !!message.deleted_at
  const isOwn = message.createdby_id === currentUserId

  const confirmDelete = () => {
    if (
      !window.confirm(
        `Delete this message? It is removed for everyone. Its replies stay, under a "deleted" placeholder.`,
      )
    )
      return
    deleteMessageAction({ id: message.id })
  }
  const [showReplies, setShowReplies] = useState(true)
  const [showReplyInput, setShowReplyInput] = useState(false)
  const [replyFiles, setReplyFiles] = useState<PendingAttachment[]>([])
  const reply = useMentions(users)

  const replies = allMessages
    .filter((m) => m.parent_id === message.id)
    .sort((a, b) => toDate(a.created_at).getTime() - toDate(b.created_at).getTime())

  const author = users.find((u) => u.id === message.createdby_id)

  // Pending uploads for this specific message
  const myPending = messagePending.filter((r) => r.messageId === message.id)

  const canSendReply = !!reply.text.trim() || replyFiles.length > 0

  const closeReply = () => {
    setShowReplyInput(false)
    reply.reset()
    setReplyFiles([])
  }

  const handleSubmitReply = () => {
    if (!canSendReply) return
    onReply(message.id, reply.text.trim(), replyFiles, reply.mentionIds)
    closeReply()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (reply.handleMentionEscape(e)) return
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmitReply()
    if (e.key === "Escape") closeReply()
  }

  return (
    <div
      // Anchor for the Inbox deep-link (?messageId=). Also the highlight target.
      id={`message-${message.id}`}
      className={`${depth > 0 ? "ml-7 border-l-2 border-card-border pl-3 mt-1" : ""} ${
        isFocused ? "bg-surface-highlight rounded transition-colors duration-1000" : ""
      }`}
    >
      <div className="flex gap-2 py-2">
        {/* Avatar */}
        <div className="w-6 h-6 rounded-full bg-card-border flex items-center justify-center text-primary text-xs font-medium flex-shrink-0">
          {avatarInitial(author)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium text-foreground">{displayName(author)}</span>
            <span className="text-xs text-muted-foreground">{formatDateTime(message.created_at)}</span>
          </div>

          {isDeleted ? (
            /* The row survives so its replies keep a parent — see deleteMessageAction.
               Nothing to hide: the server already cleared the text. */
            <p className="text-xs italic text-muted-foreground">This message was deleted</p>
          ) : (
            <p className="text-xs text-foreground whitespace-pre-wrap break-words">
              {message.text}
            </p>
          )}

          {/* Pending uploads for this message */}
          <MessagePendingChips pending={myPending} onRetry={onRetryUpload} />

          {/* Synced resources for this message */}
          <MessageResourceDisplay messageId={message.id} />

          {/* Actions row */}
          <div className="flex items-center gap-3 mt-1">
            {!isDeleted && (
              <button
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <MessageCircle className="w-3 h-3" />
                Reply
              </button>
            )}

            {/* Author only. The server enforces it (FORBIDDEN otherwise) — hiding the
                button is courtesy, not the control. */}
            {isOwn && !isDeleted && (
              <button
                onClick={confirmDelete}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-700 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            )}

            {replies.length > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {showReplies ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                {replies.length} {replies.length === 1 ? "reply" : "replies"}
              </button>
            )}
          </div>

          {/* Reply input */}
          {showReplyInput && (
            <div className="mt-1.5 bg-white border border-card-border rounded px-2 py-1.5 relative">
              <MentionDropdown users={reply.filteredUsers} onSelect={reply.selectMention} size="xs" />
              <PendingAttachmentChips
                files={replyFiles}
                onRemove={(id) => setReplyFiles((prev) => prev.filter((f) => f.id !== id))}
              />
              <textarea
                ref={reply.textareaRef}
                value={reply.text}
                onChange={reply.handleTextChange}
                onKeyDown={handleKeyDown}
                placeholder="Write a reply… (Ctrl+Enter to send)"
                className="w-full text-xs bg-transparent resize-none outline-none text-foreground placeholder-secondary"
                rows={1}
                autoFocus
              />
              <div className="flex items-center justify-between mt-1">
                <MessageAttachmentPicker
                  onAdd={(attachments) => setReplyFiles((prev) => [...prev, ...attachments])}
                />
                <div className="flex gap-0.5">
                  <button
                    onClick={handleSubmitReply}
                    disabled={!canSendReply}
                    className="p-1 bg-primary text-white rounded hover:bg-primary-hover disabled:opacity-40 transition-colors"
                  >
                    <Send className="w-3 h-3" />
                  </button>
                  <button
                    onClick={closeReply}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nested replies */}
      {showReplies &&
        replies.map((r) => (
          <MessageItem
            key={r.id}
            message={r}
            allMessages={allMessages}
            messagePending={messagePending}
            users={users}
            onReply={onReply}
            onRetryUpload={onRetryUpload}
            depth={depth + 1}
            focusMessageId={focusMessageId}
            currentUserId={currentUserId}
          />
        ))}
    </div>
  )
}
