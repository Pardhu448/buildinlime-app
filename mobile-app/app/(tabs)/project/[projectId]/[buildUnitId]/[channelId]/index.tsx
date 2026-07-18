import { View, KeyboardAvoidingView, StyleSheet, ActivityIndicator } from "react-native"
import { useCallback, useState } from "react"
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router"
import { useMessages } from "@/src/presentation/messages/hooks/useMessages"
import { MessageList } from "@/src/presentation/messages/components/MessageList"
import { MessageInput } from "@/src/presentation/messages/components/MessageInput"
import { ResourcesSheet } from "@/src/presentation/resources/components/ResourcesSheet"
import { BackHeader } from "@/src/presentation/shared/components/BackHeader"
import { useUsers } from "@/src/presentation/shared/hooks/useUsers"
import { useSeen } from "@/src/presentation/shared/hooks/useSeen"
import { TasksSheet } from "@/src/presentation/tasks/components/TasksSheet"
import { useSession } from "@/src/infrastructure/auth/client"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { channelsCollection } from "@/src/application/collections/organization"
import { colors } from "@/src/presentation/shared/colors"
import type { Channel, Message } from "@buildinlime/domain-types"

export default function ChannelScreen() {
  const { projectId, buildUnitId, channelId, messageId } = useLocalSearchParams<{
    projectId: string
    buildUnitId: string
    channelId: string
    /** Set when arriving from the Inbox — scroll to and highlight this message. */
    messageId?: string
  }>()
  const router = useRouter()
  const { data: session } = useSession()

  // Look up channel name from channelsCollection
  const { data: channelsData } = useLiveQuery(
    (q) =>
      q
        .from({ channelsCollection })
        .where(({ channelsCollection: c }) => eq(c.id, channelId)),
    [channelId]
  )
  const channel = ((channelsData ?? []) as Channel[])[0]

  const { messages, isLoading } = useMessages(channelId)
  const usersMap = useUsers()

  // Leaving a channel marks it seen: one timestamp per channel, pushed forward so
  // everything present up to that moment counts as seen and the channel's task
  // badge clears. Timestamp model — no per-message writes. useFocusEffect (cleanup
  // on BLUR), NOT useEffect: a stack screen stays mounted underneath a pushed task
  // route, so an unmount cleanup wouldn't fire when you drill into a task. Blur
  // covers both leaving the channel AND opening a task from it — matching web's
  // ChannelPage, which unmounts on either.
  const { markChannelSeen } = useSeen()
  useFocusEffect(
    useCallback(() => {
      if (!channelId) return
      return () => markChannelSeen(channelId)
    }, [channelId, markChannelSeen])
  )

  const currentUserId = session?.user?.id ?? ""

  // The message being replied to, or null. Cleared on send / dismiss.
  const [replyTo, setReplyTo] = useState<Message | null>(null)

  // "padding" on both platforms, NOT "height" on Android. Under edge-to-edge
  // (SDK 55) the window does not resize for the keyboard, so the composer needs
  // the KeyboardAvoidingView to lift it — but "height" lifts by shrinking its own
  // height and does not fully unwind on dismiss, leaving the composer parked
  // above its resting position. "padding" adds and removes cleanly.
  //
  // MessageInput drops its nav-bar inset while the keyboard is up, so the two do
  // not stack (the nav bar is behind the keyboard then).

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <BackHeader
        title={channel?.name ?? "Channel"}
        onBack={() => router.back()}
        // Tasks and Resources both live behind header buttons — half-screen
        // sheets, so neither competes with the message list for vertical space.
        actions={
          <>
            <TasksSheet
              channelId={channelId}
              buildUnitId={buildUnitId}
              projectId={projectId}
            />
            <ResourcesSheet
              channelId={channelId}
              buildUnitId={buildUnitId}
              projectId={projectId}
            />
          </>
        }
      />

      {/* Messages */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <MessageList
          channelId={channelId}
          messages={messages}
          currentUserId={currentUserId}
          usersMap={usersMap}
          onReply={setReplyTo}
          focusMessageId={messageId}
        />
      )}

      {/* Sticky message input */}
      <MessageInput
        channelId={channelId}
        buildUnitId={buildUnitId}
        projectId={projectId}
        replyTo={replyTo}
        replyToName={replyTo ? usersMap[replyTo.createdby_id] ?? "Unknown" : undefined}
        onCancelReply={() => setReplyTo(null)}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Deliberately NOT shared/ScreenStates' LoadingState: that one carries
  // paddingHorizontal + gap for its icon/title/message stack, and is scoped to the
  // Inbox and My Tasks screens. This is a bare centred spinner.
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
})
