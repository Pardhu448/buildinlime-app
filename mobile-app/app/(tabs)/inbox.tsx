import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native"
import { useEffect } from "react"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLiveQuery } from "@tanstack/react-db"
import { MessageSquare } from "lucide-react-native"
import { ScreenHeader } from "@/src/presentation/shared/components/ScreenHeader"
import { Breadcrumb } from "@/src/presentation/shared/components/Breadcrumb"
import { formatDateTime } from "@/src/presentation/shared/lib/datetime"
import { useLookups } from "@/src/presentation/shared/hooks/useLookups"
import { useSeen } from "@/src/presentation/shared/hooks/useSeen"
import { useSession } from "@/src/infrastructure/auth/client"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import { messagesCollection } from "@/src/application/collections/communication"
import { colors } from "@/src/presentation/shared/colors"
import type { Message } from "@buildinlime/domain-types"

function MentionRow({
  message,
  lookups,
  unread,
  onPress,
}: {
  message: Message
  lookups: ReturnType<typeof useLookups>
  unread: boolean
  onPress: () => void
}) {
  const { getUserName, getChannel, getBuildUnit, getProject } = lookups

  const senderName = getUserName(message.createdby_id)
  const initial = (senderName[0] ?? "?").toUpperCase()
  const channel = getChannel(message.channel_id)
  const buildUnit = getBuildUnit(message.buildunit_id)
  const project = getProject(message.project_id)

  return (
    <TouchableOpacity
      style={[styles.row, unread && styles.rowUnread]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          {/* Marks unread ONLY — a dot on every row signals nothing. Read rows
              stay in the list, de-emphasised: the Inbox is a record of what
              needed you, not a queue to drain. */}
          {unread ? <View style={styles.unreadDot} /> : null}
          <Text style={[styles.sender, unread && styles.senderUnread]} numberOfLines={1}>
            {senderName}
          </Text>
          <Text style={styles.timestamp}>{formatDateTime(message.created_at)}</Text>
        </View>
        <Text
          style={[styles.messageText, !unread && styles.messageTextRead]}
          numberOfLines={3}
        >
          {message.text}
        </Text>
        <Breadcrumb
          projectName={project?.name}
          buildUnitName={buildUnit?.name}
          channelName={channel?.name}
        />
      </View>
    </TouchableOpacity>
  )
}

function InboxContent() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data: session } = useSession()
  const currentUserId = session?.user?.id
  const lookups = useLookups()
  const { isMessageUnseen, markInboxSeen } = useSeen()

  // Leaving the Inbox marks it seen: one timestamp, pushed forward on unmount, so
  // every mention present up to that moment counts as seen and the badge clears.
  // Timestamp model — no per-message writes. Mirrors web's InboxPage.
  useEffect(() => {
    return () => markInboxSeen()
  }, [markInboxSeen])

  const { data: rawMessages, isLoading } = useLiveQuery(
    (q) => q.from({ messagesCollection }),
    []
  )

  const mentions = ((rawMessages ?? []) as Message[])
    .filter(
      (m) =>
        currentUserId &&
        Array.isArray(m.mention_ids) &&
        m.mention_ids.includes(currentUserId)
    )
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (mentions.length === 0) {
    return (
      <View style={styles.centered}>
        <MessageSquare size={40} color={colors.cardBorder} strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>No one has mentioned you yet</Text>
        <Text style={styles.emptyText}>
          Messages where you're mentioned will appear here.
        </Text>
      </View>
    )
  }

  return (
    <FlatList
      data={mentions}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      renderItem={({ item }) => (
        <MentionRow
          message={item}
          lookups={lookups}
          unread={isMessageUnseen(item.created_at)}
          onPress={() => {
            // No per-tap mark: leaving the Inbox marks the whole view seen
            // (markInboxSeen on unmount). Opening a mention navigates away, which
            // unmounts the Inbox and fires that mark.
            // Carry the message id through, or the channel opens at the top and you
            // have to hunt for the thing you just tapped. Mirrors web's ?messageId=.
            router.push(
              `/(tabs)/project/${item.project_id}/${item.buildunit_id}/${item.channel_id}?messageId=${item.id}` as any
            )
          }}
        />
      )}
      showsVerticalScrollIndicator={false}
    />
  )
}

export default function InboxScreen() {
  const { projectId } = useProjectContext()

  return (
    <View style={styles.container}>
      <ScreenHeader title="Inbox" subtitle="Your @mentions" />
      {/* Scoped collections are null until a project is initialized. */}
      {projectId ? (
        <InboxContent />
      ) : (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Select a project to see your mentions.</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.mutedForeground,
    marginTop: 6,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  gap: {
    height: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
  },
  rowUnread: {
    backgroundColor: colors.cardSurface,
    borderColor: colors.secondary,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.iconChip,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  avatarText: {
    fontSize: 12,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.primary,
  },
  rowBody: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 3,
  },
  sender: {
    flex: 1,
    fontSize: 13,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.mutedForeground,
  },
  senderUnread: {
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    flexShrink: 0,
  },
  timestamp: {
    fontSize: 11,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
  },
  messageTextRead: {
    color: colors.mutedForeground,
  },
  messageText: {
    fontSize: 13,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.foreground,
    lineHeight: 19,
  },
})
