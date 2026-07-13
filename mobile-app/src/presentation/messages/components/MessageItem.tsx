import { useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { MessageCircle, ChevronDown, ChevronRight } from "lucide-react-native"
import { MessageAttachments } from "@/src/presentation/resources/components/MessageAttachments"
import { formatDateTime } from "@/src/presentation/shared/lib/datetime"
import { colors } from "@/src/presentation/shared/colors"
import type { PendingUpload } from "@/src/infrastructure/offline/upload-manager"
import type { Message, Resource } from "@buildinlime/domain-types"

// One node of the comment tree — mirrors web's CommentsSection/MessageItem:
// avatar, author, timestamp, text, attachments, a Reply action, and a
// collapsible "N replies" subtree indented behind a left rail.

interface MessageItemProps {
  message: Message
  repliesByParent: Map<string, Message[]>
  usersMap: Record<string, string>
  resourcesByMessage: Map<string, Resource[]>
  uploadsByMessage: Map<string, PendingUpload[]>
  currentUserId: string
  onReply?: (message: Message) => void
  depth?: number
}

const EMPTY_RESOURCES: Resource[] = []
const EMPTY_UPLOADS: PendingUpload[] = []

export function MessageItem({
  message,
  repliesByParent,
  usersMap,
  resourcesByMessage,
  uploadsByMessage,
  currentUserId,
  onReply,
  depth = 0,
}: MessageItemProps) {
  const [showReplies, setShowReplies] = useState(true)

  const replies = repliesByParent.get(message.id) ?? EMPTY_MESSAGES
  const senderName = usersMap[message.createdby_id] ?? "Unknown"
  const initial = senderName.charAt(0).toUpperCase()
  const isOwn = message.createdby_id === currentUserId

  return (
    <View style={depth > 0 ? styles.nested : undefined}>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.metaRow}>
            <Text style={[styles.author, isOwn && styles.authorOwn]} numberOfLines={1}>
              {senderName}
            </Text>
            <Text style={styles.time}>{formatDateTime(message.created_at)}</Text>
          </View>

          {message.text?.trim() ? (
            <Text style={styles.text}>{message.text}</Text>
          ) : null}

          <MessageAttachments
            resources={resourcesByMessage.get(message.id) ?? EMPTY_RESOURCES}
            pendingUploads={uploadsByMessage.get(message.id) ?? EMPTY_UPLOADS}
            isOwn={false}
          />

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.action}
              onPress={() => onReply?.(message)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.6}
            >
              <MessageCircle size={12} color={colors.mutedForeground} strokeWidth={2} />
              <Text style={styles.actionText}>Reply</Text>
            </TouchableOpacity>

            {replies.length > 0 && (
              <TouchableOpacity
                style={styles.action}
                onPress={() => setShowReplies((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.6}
              >
                {showReplies ? (
                  <ChevronDown size={12} color={colors.mutedForeground} strokeWidth={2} />
                ) : (
                  <ChevronRight size={12} color={colors.mutedForeground} strokeWidth={2} />
                )}
                <Text style={styles.actionText}>
                  {replies.length} {replies.length === 1 ? "reply" : "replies"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {showReplies &&
        replies.map((reply) => (
          <MessageItem
            key={reply.id}
            message={reply}
            repliesByParent={repliesByParent}
            usersMap={usersMap}
            resourcesByMessage={resourcesByMessage}
            uploadsByMessage={uploadsByMessage}
            currentUserId={currentUserId}
            onReply={onReply}
            depth={depth + 1}
          />
        ))}
    </View>
  )
}

const EMPTY_MESSAGES: Message[] = []

const styles = StyleSheet.create({
  // The left rail is what makes a conversation legible at a glance.
  nested: {
    marginLeft: 14,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.cardBorder,
    marginTop: 2,
  },
  row: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 8,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.iconChip,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 11,
    fontFamily: "InstrumentSans_600SemiBold",
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  author: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
  },
  authorOwn: {
    color: colors.primary,
  },
  time: {
    fontSize: 11,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
  },
  text: {
    fontSize: 13,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.foreground,
    lineHeight: 19,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 5,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionText: {
    fontSize: 11,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.mutedForeground,
  },
})
