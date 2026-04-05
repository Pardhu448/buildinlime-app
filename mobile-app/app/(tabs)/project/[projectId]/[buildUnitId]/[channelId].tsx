import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from "react-native"
import { useState } from "react"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useMessages } from "@/src/presentation/messages/hooks/useMessages"
import { useProperties } from "@/src/presentation/properties/hooks/useProperties"
import { MessageList } from "@/src/presentation/messages/components/MessageList"
import { MessageInput } from "@/src/presentation/messages/components/MessageInput"
import { PropertyPill } from "@/src/presentation/properties/components/PropertyPill"
import { ResourcesSection } from "@/src/presentation/resources/components/ResourcesSection"
import { useSession } from "@/src/infrastructure/auth/client"
import { useLiveQuery, eq } from "@tanstack/react-db"
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
  const { data: channelsData } = useLiveQuery(
    (q) =>
      q
        .from({ channelsCollection: collections!.channelsCollection })
        .where(({ channelsCollection: c }) => eq(c.id, channelId)),
    [collections, channelId]
  )
  const channel = ((channelsData ?? []) as Channel[])[0]

  const { messages, isLoading } = useMessages(channelId)
  const { properties } = useProperties(channelId)

  // Only show channel-level properties
  const channelProperties = properties.filter((p) => p.entity === "channel")

  const [propertiesExpanded, setPropertiesExpanded] = useState(true)

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

      {/* Collapsible properties */}
      {channelProperties.length > 0 && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setPropertiesExpanded((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionLabel}>Properties</Text>
            <Text style={styles.chevron}>{propertiesExpanded ? "⌄" : "›"}</Text>
          </TouchableOpacity>
          {propertiesExpanded && (
            <View style={styles.pillsContainer}>
              {channelProperties.map((prop) => (
                <PropertyPill key={prop.id} property={prop} />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Collapsible resources */}
      <ResourcesSection channelId={channelId} />

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
  section: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chevron: {
    fontSize: 16,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  pillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
})
