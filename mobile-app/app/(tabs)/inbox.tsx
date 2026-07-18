import { View, StyleSheet } from "react-native"
import { useCallback } from "react"
import { useRouter, useFocusEffect } from "expo-router"
import { useLiveQuery } from "@tanstack/react-db"
import { MessageSquare } from "lucide-react-native"
import { ScreenHeader } from "@/src/presentation/shared/components/ScreenHeader"
import { CardList } from "@/src/presentation/shared/components/CardList"
import { LoadingState, EmptyState } from "@/src/presentation/shared/components/ScreenStates"
import { MentionRow } from "@/src/presentation/messages/components/MentionRow"
import { useLookups } from "@/src/presentation/shared/hooks/useLookups"
import { useSeen } from "@/src/presentation/shared/hooks/useSeen"
import { useSession } from "@/src/infrastructure/auth/client"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import { messagesCollection } from "@/src/application/collections/communication"
import { colors } from "@/src/presentation/shared/colors"
import type { Message } from "@buildinlime/domain-types"
import { toDate } from "@buildinlime/contracts"

function InboxContent() {
  const router = useRouter()
  const { data: session } = useSession()
  const currentUserId = session?.user?.id
  const lookups = useLookups()
  const { isMessageUnseen, markInboxSeen } = useSeen()

  // Leaving the Inbox marks it seen: one timestamp, pushed forward so every
  // mention present up to that moment counts as seen and the drawer badge clears.
  // Timestamp model — no per-message writes. useFocusEffect, NOT useEffect: the
  // Drawer keeps this screen MOUNTED when you switch drawer items, so an unmount
  // cleanup would never fire and the badge would go stale. The focus-effect
  // cleanup runs on BLUR (navigating away), which is the real "leave". Mirrors
  // web's InboxPage unmount, adapted to the mobile navigator.
  useFocusEffect(
    useCallback(() => {
      return () => markInboxSeen()
    }, [markInboxSeen])
  )

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
    .sort((a, b) => toDate(b.created_at).getTime() - toDate(a.created_at).getTime())

  if (isLoading) return <LoadingState />

  if (mentions.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No one has mentioned you yet"
        message="Messages where you're mentioned will appear here."
      />
    )
  }

  return (
    <CardList
      data={mentions}
      keyExtractor={(item) => item.id}
      renderItem={(item) => (
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
        <EmptyState message="Select a project to see your mentions." />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
})
