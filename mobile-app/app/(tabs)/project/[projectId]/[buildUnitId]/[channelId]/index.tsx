import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  StyleSheet,
  ActivityIndicator,
} from "react-native"
import { useCallback, useState } from "react"
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useMessages } from "@/src/presentation/messages/hooks/useMessages"
import { MessageList } from "@/src/presentation/messages/components/MessageList"
import { MessageInput } from "@/src/presentation/messages/components/MessageInput"
import { ResourcesSheet } from "@/src/presentation/resources/components/ResourcesSheet"
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
  const insets = useSafeAreaInsets()

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
      {/* Inline header with back button */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.6}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {channel?.name ?? "Channel"}
        </Text>
        {/* Tasks and Resources both live behind header buttons — half-screen
            sheets, so neither competes with the message list for vertical space. */}
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
      </View>

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
  header: {
    flexDirection: "row",
    alignItems: "center",
    // paddingTop applied inline from useSafeAreaInsets().top (real device inset).
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  backButton: {
    padding: 4,
    marginRight: 4,
  },
  backArrow: {
    fontSize: 32,
    color: colors.primary,
    fontFamily: "InstrumentSans_400Regular",
    lineHeight: 32,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
    lineHeight: 22,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
})
