import { View, Text, StyleSheet } from "react-native"
import { colors } from "@/src/presentation/shared/colors"
import type { Message } from "@buildinlime/domain-types"

interface MessageBubbleProps {
  message: Message
  senderName: string
  isOwn: boolean
}

function formatTime(date: Date | string | undefined): string {
  if (!date) return ""
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return ""
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
}

export function MessageBubble({ message, senderName, isOwn }: MessageBubbleProps) {
  const initial = senderName.charAt(0).toUpperCase()

  return (
    <View style={[styles.container, isOwn ? styles.containerOwn : styles.containerOther]}>
      {!isOwn && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      )}
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        {!isOwn && (
          <Text style={styles.senderName}>{senderName}</Text>
        )}
        <Text style={[styles.messageText, isOwn ? styles.messageTextOwn : styles.messageTextOther]}>
          {message.text}
        </Text>
        <Text style={[styles.timestamp, isOwn ? styles.timestampOwn : styles.timestampOther]}>
          {formatTime(message.created_at)}
        </Text>
      </View>
      {isOwn && (
        <View style={[styles.avatar, styles.avatarOwn]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: 4,
    paddingHorizontal: 16,
    gap: 8,
  },
  containerOwn: {
    justifyContent: "flex-end",
  },
  containerOther: {
    justifyContent: "flex-start",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarOwn: {
    backgroundColor: colors.secondary ?? colors.primary,
  },
  avatarText: {
    color: colors.primaryForeground,
    fontSize: 13,
    fontFamily: "InstrumentSans_700Bold",
  },
  bubble: {
    maxWidth: "72%",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  bubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.muted,
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 11,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.primary,
    marginBottom: 2,
  },
  messageText: {
    fontSize: 14,
    fontFamily: "InstrumentSans_400Regular",
    lineHeight: 20,
  },
  messageTextOwn: {
    color: colors.primaryForeground,
  },
  messageTextOther: {
    color: colors.foreground,
  },
  timestamp: {
    fontSize: 10,
    fontFamily: "InstrumentSans_400Regular",
    marginTop: 2,
  },
  timestampOwn: {
    color: colors.primaryForeground + "99",
    textAlign: "right",
  },
  timestampOther: {
    color: colors.mutedForeground,
    textAlign: "left",
  },
})
