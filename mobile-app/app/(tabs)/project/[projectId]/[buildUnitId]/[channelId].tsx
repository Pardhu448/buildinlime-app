import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  StatusBar,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useMessages } from "@/src/presentation/messages/hooks/useMessages"
import { useProperties } from "@/src/presentation/properties/hooks/useProperties"
import { MessageList } from "@/src/presentation/messages/components/MessageList"
import { MessageInput } from "@/src/presentation/messages/components/MessageInput"
import { PropertyPill } from "@/src/presentation/properties/components/PropertyPill"
import { useSession } from "@/src/infrastructure/auth/client"
import { useCollection } from "@tanstack/react-db"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import { colors } from "@/src/presentation/shared/colors"
import type { Channel } from "@buildinlime/domain-types"

export default function ChannelScreen() {
  const { projectId, buildUnitId, channelId } = useLocalSearchParams<{
    projectId: string
    buildUnitId: string
    channelId: string
  }>()
  const router = useRouter()
  const { data: session } = useSession()
  const { collections } = useProjectContext()

  // Look up channel name from channelsCollection
  const { data: channelsData } = useCollection(collections!.channelsCollection, {
    select: (items) => [...items.values()] as Channel[],
  })
  const channel = (channelsData ?? []).find((c) => c.id === channelId)

  const { messages, isLoading } = useMessages(channelId)
  const { properties } = useProperties(channelId)

  // Only show channel-level properties
  const channelProperties = properties.filter((p) => p.entity === "channel")

  const currentUserId = session?.user?.id ?? ""

  // Build a basic users map from message senders (best-effort without a users collection)
  const usersMap: Record<string, string> = {}
  for (const msg of messages) {
    if (!usersMap[msg.createdby_id]) {
      usersMap[msg.createdby_id] =
        msg.createdby_id === currentUserId
          ? session?.user?.name ?? "Me"
          : `User ${msg.createdby_id.slice(0, 6)}`
    }
  }
  if (currentUserId && !usersMap[currentUserId]) {
    usersMap[currentUserId] = session?.user?.name ?? "Me"
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* Inline header with back button */}
      <View style={styles.header}>
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
      </View>

      {/* Optional property pills row */}
      {channelProperties.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsContainer}
          style={styles.pillsScroll}
        >
          {channelProperties.map((prop) => (
            <PropertyPill key={prop.id} property={prop} />
          ))}
        </ScrollView>
      )}

      {/* Messages */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <MessageList
          messages={messages}
          currentUserId={currentUserId}
          usersMap={usersMap}
        />
      )}

      {/* Sticky message input */}
      <MessageInput
        channelId={channelId}
        buildUnitId={buildUnitId}
        projectId={projectId}
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
    paddingTop: (StatusBar.currentHeight ?? 44) + 8,
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
  pillsScroll: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pillsContainer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
})
