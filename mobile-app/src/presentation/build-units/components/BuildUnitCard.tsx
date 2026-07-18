import { TouchableOpacity, View, Text, StyleSheet } from "react-native"
// Package (a single box), NOT Boxes (a stack) — matching web, which uses Package
// for build units everywhere (BuildUnitCard, BuildUnitsNav, BuildUnitsTable,
// BuildUnitsTeamNav, BuildUnitPage) and reserves Boxes for PROJECTS.
import { Package } from "lucide-react-native"
import { colors } from "@/src/presentation/shared/colors"
import { PropertyPill } from "@/src/presentation/properties/components/PropertyPill"
import type { BuildUnit, Property } from "@buildinlime/domain-types"

interface BuildUnitCardProps {
  buildUnit: BuildUnit
  properties?: Property[]
  onPress: () => void
}

// NOTE: the `health` / `priority` / `task_name` / `status_percent` columns on
// `buildunits` are vestigial — nothing writes them (there is no build-units
// action; `actions/properties.ts` is the only property writer). Web's card only
// renders them because it defaults the nulls. Real properties come from
// `propertiesCollection` with entity "buildUnit", same as the detail screen.
export function BuildUnitCard({ buildUnit, properties, onPress }: BuildUnitCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.header}>
        <View style={styles.iconChip}>
          <Package size={20} color={colors.primary} strokeWidth={2} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {buildUnit.name}
          </Text>
          {buildUnit.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {buildUnit.description}
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
    lineHeight: 17,
  },
  pillRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
})
