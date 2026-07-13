import { TouchableOpacity, View, Text, StyleSheet } from "react-native"
import { Folder } from "lucide-react-native"
import { CHANNEL_ICONS } from "@/src/presentation/shared/channelIcons"
import { PropertyPill } from "@/src/presentation/properties/components/PropertyPill"
import { colors } from "@/src/presentation/shared/colors"
import type { Channel, Property } from "@buildinlime/domain-types"

interface ChannelCardProps {
  channel: Channel
  properties?: Property[]
  onPress: () => void
}

export function ChannelCard({ channel, properties, onPress }: ChannelCardProps) {
  const Icon = CHANNEL_ICONS[channel.name] ?? Folder

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.header}>
        <View style={styles.iconChip}>
          <Icon size={20} color={colors.primary} strokeWidth={2} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {channel.name}
          </Text>
          {channel.description ? (
            <Text style={styles.description} numberOfLines={1}>
              {channel.description}
            </Text>
          ) : null}
        </View>
      </View>

      {properties && properties.length > 0 ? (
        <View style={styles.pillRow}>
          {properties.map((p) => (
            <PropertyPill key={p.id} property={p} />
          ))}
        </View>
      ) : null}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.iconChip,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
  },
  description: {
    fontSize: 12,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
  },
  pillRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
})
