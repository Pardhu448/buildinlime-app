import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { Breadcrumb } from "@/src/presentation/shared/components/Breadcrumb"
import { formatDateTime } from "@/src/presentation/shared/lib/datetime"
import { useLookups } from "@/src/presentation/shared/hooks/useLookups"
import { colors } from "@/src/presentation/shared/colors"
import type { Message } from "@buildinlime/domain-types"

interface MentionRowProps {
  message: Message
  /** Passed in rather than called here: one hook for the list, not one per row. */
  lookups: ReturnType<typeof useLookups>
  unread: boolean
  onPress: () => void
}

/** One @mention in the Inbox: who said it, what they said, and where. */
export function MentionRow({ message, lookups, unread, onPress }: MentionRowProps) {
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
        <Text style={[styles.messageText, !unread && styles.messageTextRead]} numberOfLines={3}>
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

const styles = StyleSheet.create({
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
