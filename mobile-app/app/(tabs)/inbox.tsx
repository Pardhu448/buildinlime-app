import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native"
import { ScreenHeader } from "@/src/presentation/shared/components/ScreenHeader"
import { useCollection } from "@tanstack/react-db"
import { useSession } from "@/src/infrastructure/auth/client"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import { colors } from "@/src/presentation/shared/colors"
import type { Message } from "@buildinlime/domain-types"

function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function MentionItem({ message }: { message: Message }) {
  return (
    <View style={styles.mentionItem}>
      <View style={styles.mentionDot} />
      <View style={styles.mentionContent}>
        <View style={styles.mentionHeader}>
          <Text style={styles.channelLabel} numberOfLines={1}>
            Channel message
          </Text>
          <Text style={styles.timestamp}>{formatTime(message.created_at)}</Text>
        </View>
        <Text style={styles.messageText} numberOfLines={3}>
          {message.text}
        </Text>
      </View>
    </View>
  )
}

export default function InboxScreen() {
  const { data: session } = useSession()
  const { projectId, collections } = useProjectContext()
  const currentUserId = session?.user?.id

  const { data: allMessages } = useCollection(
    collections?.messagesCollection ?? ({} as any),
    {
      select: (items) => {
        if (!currentUserId) return []
        return ([...items.values()] as Message[])
          .filter(
            (m) =>
              Array.isArray(m.mention_ids) &&
              m.mention_ids.includes(currentUserId)
          )
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
      },
    }
  )

  const isLoading = allMessages === undefined && !!projectId
  const mentions = allMessages ?? []

  return (
    <View style={styles.container}>
      <ScreenHeader title="Inbox" subtitle="Your @mentions" />

      {!projectId ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Select a project first.</Text>
        </View>
      ) : isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : mentions.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No mentions yet.</Text>
        </View>
      ) : (
        <FlatList
          data={mentions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <MentionItem message={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
        />
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
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  mentionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
  },
  mentionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
    flexShrink: 0,
  },
  mentionContent: {
    flex: 1,
    gap: 4,
  },
  mentionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  channelLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.primary,
  },
  timestamp: {
    fontSize: 11,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
  },
  messageText: {
    fontSize: 14,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.foreground,
    lineHeight: 20,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 20,
  },
})
