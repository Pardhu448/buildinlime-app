import { TouchableOpacity, View, Text, StyleSheet } from "react-native"
import { colors } from "@/src/presentation/shared/colors"
import type { Channel } from "@buildinlime/domain-types"

const CHANNEL_EMOJI: Record<string, string> = {
  Finance: "💰",
  Requirements: "📋",
  Design: "📐",
  Materials: "🚛",
  Tools: "🔨",
  Execution: "✅",
  Experimentation: "🔬",
}

interface ChannelCardProps {
  channel: Channel
  onPress: () => void
}

export function ChannelCard({ channel, onPress }: ChannelCardProps) {
  const emoji = CHANNEL_EMOJI[channel.name] ?? "📁"

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.emojiContainer}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {channel.name}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  emojiContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 22,
  },
  name: {
    fontSize: 13,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
    textAlign: "center",
    lineHeight: 18,
  },
})
