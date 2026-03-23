import { TouchableOpacity, View, Text, StyleSheet } from "react-native"
import { colors } from "@/src/presentation/shared/colors"
import { HealthPill, PriorityTagPill } from "@/src/presentation/properties/components/PropertyPill"
import type { BuildUnit } from "@buildinlime/domain-types"

interface BuildUnitCardProps {
  buildUnit: BuildUnit
  onPress: () => void
}

export function BuildUnitCard({ buildUnit, onPress }: BuildUnitCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <Text style={styles.name} numberOfLines={2}>
        {buildUnit.name}
      </Text>
      {buildUnit.description ? (
        <Text style={styles.description} numberOfLines={1}>
          {buildUnit.description}
        </Text>
      ) : null}
      {(buildUnit.health || buildUnit.priority) ? (
        <View style={styles.pillRow}>
          {buildUnit.health ? <HealthPill health={buildUnit.health} /> : null}
          {buildUnit.priority ? <PriorityTagPill priority={buildUnit.priority} /> : null}
        </View>
      ) : null}
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
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  name: {
    fontSize: 14,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
    lineHeight: 20,
  },
  description: {
    fontSize: 12,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
    lineHeight: 17,
  },
  pillRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 2,
  },
})
