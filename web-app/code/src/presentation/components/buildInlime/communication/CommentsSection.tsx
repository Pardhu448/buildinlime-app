import { useState, useRef } from "react"
import { useLiveQuery } from "@tanstack/react-db"
import { MessageCircle, ChevronDown, ChevronRight, Send, X, Loader, RefreshCw } from "lucide-react"
import {
  messagesCollection,
  usersCollection,
} from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { usePendingResources, type PendingResource } from "%/application/hooks/use-pending-resources"
import { CommentInput, mentionDisplayName, type MentionUser } from "./CommentInput"
import {
  MessageResourceDisplay,
  MessageAttachmentPicker,
  PendingAttachmentChips,
  mimeIcon,
  type PendingAttachment,
} from "./MessageResourceSection"
import type { Message } from "%/domain/communication/types"

export interface CommentsSectionProps {
  channelId: string
  buildunitId: string
  projectId: string
  currentUserId: string
  memberIds: string[]
}

type UserEntry = MentionUser

function formatTimestamp(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

function displayName(user: UserEntry | undefined) {
  if (!user) return "Unknown"
  return user.name?.trim() || user.email?.trim() || "Unknown"
}

function avatarInitial(user: UserEntry | undefined) {
  return displayName(user)[0]?.toUpperCase() ?? "?"
}

interface MessageItemProps {
  message: Message
  allMessages: Message[]
  messagePending: PendingResource[]
  users: UserEntry[]
  onReply: (parentId: string, text: string, files: PendingAttachment[], mentionIds: string[]) => void
  onRetryUpload: (id: string) => void
  depth?: number
}

function MessageItem({
  message,
  allMessages,
  messagePending,
  users,
  onReply,
  onRetryUpload,
  depth = 0,
}: MessageItemProps) {
  const [showReplies, setShowReplies] = useState(true)
  const [showReplyInput, setShowReplyInput] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [replyFiles, setReplyFiles] = useState<PendingAttachment[]>([])
  const [replyMentionQuery, setReplyMentionQuery] = useState<string | null>(null)
  const [replyMentionIds, setReplyMentionIds] = useState<string[]>([])
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null)

  const replies = allMessages
    .filter((m) => m.parent_id === message.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const author = users.find((u) => u.id === message.createdby_id)

  // Pending uploads for this specific message
  const myPending = messagePending.filter((r) => r.messageId === message.id)

  const canSendReply = !!replyText.trim() || replyFiles.length > 0

  const replyFilteredUsers =
    replyMentionQuery !== null
      ? users.filter((u) =>
          mentionDisplayName(u).toLowerCase().includes(replyMentionQuery.toLowerCase())
        )
      : []

  const handleReplyTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    setReplyText(newText)
    const cursorPos = e.target.selectionStart ?? newText.length
    const match = newText.slice(0, cursorPos).match(/@(\w*)$/)
    setReplyMentionQuery(match ? match[1] : null)
  }

  const handleSelectReplyMention = (user: UserEntry) => {
    const name = mentionDisplayName(user)
    const cursorPos = replyTextareaRef.current?.selectionStart ?? replyText.length
    const before = replyText.slice(0, cursorPos).replace(/@\w*$/, `@${name} `)
    setReplyText(before + replyText.slice(cursorPos))
    setReplyMentionIds((prev) => (prev.includes(user.id) ? prev : [...prev, user.id]))
    setReplyMentionQuery(null)
    setTimeout(() => replyTextareaRef.current?.focus(), 0)
  }

  const handleSubmitReply = () => {
    if (!canSendReply) return
    onReply(message.id, replyText.trim(), replyFiles, replyMentionIds)
    setReplyText("")
    setReplyFiles([])
    setReplyMentionIds([])
    setReplyMentionQuery(null)
    setShowReplyInput(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (replyMentionQuery !== null && e.key === "Escape") {
      e.preventDefault()
      setReplyMentionQuery(null)
      return
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmitReply()
    if (e.key === "Escape") {
      setShowReplyInput(false)
      setReplyText("")
      setReplyFiles([])
      setReplyMentionIds([])
    }
  }

  return (
    <div className={depth > 0 ? "ml-7 border-l-2 border-[#e5d4c1] pl-3 mt-1" : ""}>
      <div className="flex gap-2 py-2">
        {/* Avatar */}
        <div className="w-6 h-6 rounded-full bg-[#e5d4c1] flex items-center justify-center text-[#976623] text-xs font-medium flex-shrink-0">
          {avatarInitial(author)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium text-[#1e1e1e]">{displayName(author)}</span>
            <span className="text-xs text-[#717182]">{formatTimestamp(message.created_at)}</span>
          </div>

          <p className="text-xs text-[#1e1e1e] whitespace-pre-wrap break-words">
            {message.text}
          </p>

          {/* Pending uploads for this message */}
          {myPending.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {myPending.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-1.5 px-2 py-1 bg-white border border-[#e5d4c1] rounded text-xs text-[#717182]"
                >
                  {r.status === "uploading" ? (
                    <Loader className="w-3 h-3 animate-spin shrink-0" />
                  ) : r.status === "error" ? (
                    mimeIcon(r.file.type, "w-3 h-3 text-red-400")
                  ) : (
                    mimeIcon(r.file.type, "w-3 h-3 text-[#976623]")
                  )}
                  <span className="max-w-[140px] truncate">{r.name}</span>
                  {r.status === "error" && (
                    <>
                      <span className="text-red-500 shrink-0">Failed</span>
                      <button
                        onClick={() => onRetryUpload(r.id)}
                        title="Retry upload"
                        className="shrink-0 text-[#717182] hover:text-[#976623] transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Synced resources for this message */}
          <MessageResourceDisplay messageId={message.id} />

          {/* Actions row */}
          <div className="flex items-center gap-3 mt-1">
            <button
              onClick={() => setShowReplyInput(!showReplyInput)}
              className="flex items-center gap-1 text-xs text-[#717182] hover:text-[#976623] transition-colors"
            >
              <MessageCircle className="w-3 h-3" />
              Reply
            </button>

            {replies.length > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="flex items-center gap-1 text-xs text-[#717182] hover:text-[#976623] transition-colors"
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
            <div className="mt-1.5 bg-white border border-[#e5d4c1] rounded px-2 py-1.5 relative">
              {/* Mention dropdown */}
              {replyMentionQuery !== null && replyFilteredUsers.length > 0 && (
                <div className="absolute bottom-full left-0 mb-1 w-full bg-white border border-[#e5d4c1] rounded-lg shadow-lg max-h-36 overflow-y-auto z-10">
                  {replyFilteredUsers.map((u) => (
                    <button
                      key={u.id}
                      onMouseDown={(e) => { e.preventDefault(); handleSelectReplyMention(u) }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#1e1e1e] hover:bg-[#fdf8f2] transition-colors"
                    >
                      <div className="w-5 h-5 rounded-full bg-[#e5d4c1] flex items-center justify-center text-[#976623] text-xs font-medium flex-shrink-0">
                        {mentionDisplayName(u)[0].toUpperCase()}
                      </div>
                      <span className="truncate">{mentionDisplayName(u)}</span>
                    </button>
                  ))}
                </div>
              )}
              <PendingAttachmentChips
                files={replyFiles}
                onRemove={(id) => setReplyFiles((prev) => prev.filter((f) => f.id !== id))}
              />
              <textarea
                ref={replyTextareaRef}
                value={replyText}
                onChange={handleReplyTextChange}
                onKeyDown={handleKeyDown}
                placeholder="Write a reply… (Ctrl+Enter to send)"
                className="w-full text-xs bg-transparent resize-none outline-none text-[#1e1e1e] placeholder-[#ac7f5e]"
                rows={1}
                autoFocus
              />
              <div className="flex items-center justify-between mt-1">
                <MessageAttachmentPicker
                  onAdd={(attachments) =>
                    setReplyFiles((prev) => [...prev, ...attachments])
                  }
                />
                <div className="flex gap-0.5">
                  <button
                    onClick={handleSubmitReply}
                    disabled={!canSendReply}
                    className="p-1 bg-[#976623] text-white rounded hover:bg-[#7a521c] disabled:opacity-40 transition-colors"
                  >
                    <Send className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => {
                      setShowReplyInput(false)
                      setReplyText("")
                      setReplyFiles([])
                    }}
                    className="p-1 text-[#717182] hover:text-[#1e1e1e] transition-colors"
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
        replies.map((reply) => (
          <MessageItem
            key={reply.id}
            message={reply}
            allMessages={allMessages}
            messagePending={messagePending}
            users={users}
            onReply={onReply}
            onRetryUpload={onRetryUpload}
            depth={depth + 1}
          />
        ))}
    </div>
  )
}

export function CommentsSection({
  channelId,
  buildunitId,
  projectId,
  currentUserId,
  memberIds,
}: CommentsSectionProps) {
  const { data: allMessages } = useLiveQuery(
    (q) => q.from({ messagesCollection }),
    [channelId]
  )

  const { data: users } = useLiveQuery(
    (q) => q.from({ usersCollection }),
    []
  )

  const { messagePending, addPending, scheduleUpload, retryUpload } = usePendingResources(channelId)

  const topLevelMessages = (allMessages ?? [])
    .filter((m) => m.channel_id === channelId && !m.parent_id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const handleSendMessage = async (text: string, files: PendingAttachment[], mentionIds: string[]) => {
    const messageId = crypto.randomUUID()

    // Insert message first so resources can reference it via FK
    await messagesCollection.insert({
      id: messageId,
      text: text || "(attachment)",
      created_at: new Date(),
      channel_id: channelId,
      buildunit_id: buildunitId,
      project_id: projectId,
      createdby_id: currentUserId,
      mention_ids: mentionIds,
      resource_ids: [],
      parent_id: null,
    })

    // Queue each file through usePendingResources and upload immediately
    for (const f of files) {
      const id = addPending(f.file, {
        name: f.file.name,
        description: "attached with a message",
        channelId,
        messageId,
        buildunitId,
        projectId,
        createdbyId: currentUserId,
        memberIds,
      })
      scheduleUpload(id, null) // null = upload immediately
    }
  }

  const handleReply = async (parentId: string, text: string, files: PendingAttachment[], mentionIds: string[]) => {
    const messageId = crypto.randomUUID()

    await messagesCollection.insert({
      id: messageId,
      text: text || "(attachment)",
      created_at: new Date(),
      channel_id: channelId,
      buildunit_id: buildunitId,
      project_id: projectId,
      createdby_id: currentUserId,
      mention_ids: mentionIds,
      resource_ids: [],
      parent_id: parentId,
    })

    for (const f of files) {
      const id = addPending(f.file, {
        name: f.file.name,
        description: "attached with a message",
        channelId,
        messageId,
        buildunitId,
        projectId,
        createdbyId: currentUserId,
        memberIds,
      })
      scheduleUpload(id, null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="pb-2">
        <CommentInput
          placeholder="Write a comment…"
          rows={1}
          users={users ?? []}
          onSend={handleSendMessage}
        />
      </div>

      {topLevelMessages.length > 0 ? (
        <div className="divide-y divide-[#e5d4c1]">
          {topLevelMessages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              allMessages={allMessages ?? []}
              messagePending={messagePending}
              users={users ?? []}
              onReply={handleReply}
              onRetryUpload={retryUpload}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#717182] py-2 text-center">
          No comments yet. Be the first to comment!
        </p>
      )}
    </div>
  )
}
