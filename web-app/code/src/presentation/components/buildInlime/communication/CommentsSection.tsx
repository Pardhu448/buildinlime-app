import { useEffect } from "react"
import { useLiveQuery } from "@tanstack/react-db"
import {
  messagesCollection,
  usersCollection,
  tasksCollection,
} from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { createMessageAction } from "%/application/actions/messages"
import { usePendingResources } from "%/application/hooks/use-pending-resources"
import { CommentInput } from "./CommentInput"
import { MessageItem } from "./MessageItem"
import type { PendingAttachment } from "./MessageResourceSection"
import { toDate } from "@buildinlime/contracts"

export interface CommentsSectionProps {
  channelId: string
  buildunitId: string
  projectId: string
  currentUserId: string
  memberIds: string[]
  /** Route names for this channel, so a status-note can link to its task. */
  buildUnitName: string
  channelName: string
  /** ?messageId= from the Inbox — scroll to and briefly highlight this message. */
  focusMessageId?: string
}

export function CommentsSection({
  channelId,
  buildunitId,
  projectId,
  currentUserId,
  memberIds,
  buildUnitName,
  channelName,
  focusMessageId,
}: CommentsSectionProps) {
  const { data: allMessages } = useLiveQuery((q) => q.from({ messagesCollection }), [channelId])

  const { data: allUsers } = useLiveQuery((q) => q.from({ usersCollection }), [])
  const users = (allUsers ?? []).filter((u) => memberIds.includes(u.id))

  // task_id -> name, so a status-change note can link to its task. The task route
  // is name-based, and the note only carries the id. The `| undefined` cast is
  // load-bearing: useLiveQuery types data as a plain array, but it is undefined on
  // the first render before the query resolves — so the `?? []` is necessary, not
  // lint noise. Mirrors ResourceDisplay's pattern in this folder.
  const { data: allTasks } = useLiveQuery((q) => q.from({ tasksCollection }), [])
  const taskNameById = new Map(
    ((allTasks as { id: string; name: string }[] | undefined) ?? []).map((t) => [t.id, t.name]),
  )

  const { messagePending, addPending, scheduleUpload, retryUpload } = usePendingResources(channelId)

  const topLevelMessages = (allMessages ?? [])
    .filter((m) => m.channel_id === channelId && !m.parent_id)
    .sort((a, b) => toDate(b.created_at).getTime() - toDate(a.created_at).getTime())

  // Scroll the deep-linked message into view once it has actually rendered.
  // Depends on allMessages: on a cold load the collection is still syncing when
  // this first runs, so the element does not exist yet and a one-shot scroll on
  // mount would silently do nothing.
  useEffect(() => {
    if (!focusMessageId) return
    const el = document.getElementById(`message-${focusMessageId}`)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [focusMessageId, allMessages])

  // Both the top-level composer and every reply funnel through here: insert the
  // message first (so resources can reference it via FK), then queue each file.
  //
  // NOTE: createMessageAction is fire-and-forget. The first /api/resources/upload
  // may return an FK error because the message tRPC hasn't landed yet; the upload
  // retry path catches up shortly after. Tracked for a cleaner fix (task #9-followup).
  const composeMessage = (
    parentId: string | null,
    text: string,
    files: PendingAttachment[],
    mentionIds: string[],
  ) => {
    const messageId = crypto.randomUUID()

    createMessageAction({
      id: messageId,
      text: text || "(attachment)",
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
      })
      scheduleUpload(id, null) // null = upload immediately
    }
  }

  const handleSendMessage = (text: string, files: PendingAttachment[], mentionIds: string[]) =>
    composeMessage(null, text, files, mentionIds)

  const handleReply = (
    parentId: string,
    text: string,
    files: PendingAttachment[],
    mentionIds: string[],
  ) => composeMessage(parentId, text, files, mentionIds)

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
        <div className="divide-y divide-card-border">
          {topLevelMessages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              allMessages={allMessages ?? []}
              messagePending={messagePending}
              users={users ?? []}
              onReply={handleReply}
              onRetryUpload={retryUpload}
              focusMessageId={focusMessageId}
              currentUserId={currentUserId}
              buildUnitName={buildUnitName}
              channelName={channelName}
              taskNameById={taskNameById}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground py-2 text-center">
          No comments yet. Be the first to comment!
        </p>
      )}
    </div>
  )
}
