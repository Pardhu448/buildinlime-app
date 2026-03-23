import { View, Text, StyleSheet } from "react-native"
import { colors } from "@/src/presentation/shared/colors"
import type { Property } from "@buildinlime/domain-types"

// Status value colors
const STATUS_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
}

// Priority value colors
const PRIORITY_COLORS: Record<string, string> = {
  notStarted: colors.mutedForeground,
  inProgress: "#3b82f6",
  onTrack: "#22c55e",
  atRisk: "#f97316",
  backLog: colors.mutedForeground,
  overBudget: "#ef4444",
  onHold: colors.mutedForeground,
  completed: "#22c55e",
  cancelled: colors.mutedForeground,
}

// Health value colors
const HEALTH_COLORS: Record<string, string> = {
  "On track": "#22c55e",
  "At risk": "#f97316",
  "Off track": "#ef4444",
}

// Human-readable labels for priority values
const PRIORITY_LABELS: Record<string, string> = {
  notStarted: "Not Started",
  inProgress: "In Progress",
  onTrack: "On Track",
  atRisk: "At Risk",
  backLog: "Backlog",
  overBudget: "Over Budget",
  onHold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
}

interface PropertyPillProps {
  property: Property
}

export function PropertyPill({ property }: PropertyPillProps) {
  if (property.type === "status" && property.status_value) {
    const bgColor = STATUS_COLORS[property.status_value] ?? colors.mutedForeground
    return (
      <View style={[styles.pill, { backgroundColor: bgColor + "22", borderColor: bgColor }]}>
        <View style={[styles.dot, { backgroundColor: bgColor }]} />
        <Text style={[styles.pillText, { color: bgColor }]}>
          {property.status_value.charAt(0).toUpperCase() + property.status_value.slice(1)}
        </Text>
      </View>
    )
  }

  if (property.type === "priority" && property.priority_value) {
    const bgColor = PRIORITY_COLORS[property.priority_value] ?? colors.mutedForeground
    return (
      <View style={[styles.pill, { backgroundColor: bgColor + "22", borderColor: bgColor }]}>
        <View style={[styles.dot, { backgroundColor: bgColor }]} />
        <Text style={[styles.pillText, { color: bgColor }]}>
          {PRIORITY_LABELS[property.priority_value] ?? property.priority_value}
        </Text>
      </View>
    )
  }

  return null
}

// Simpler inline pill for build unit health/priority fields
interface HealthPillProps {
  health: "On track" | "At risk" | "Off track" | null | undefined
}

export function HealthPill({ health }: HealthPillProps) {
  if (!health) return null
  const bgColor = HEALTH_COLORS[health] ?? colors.mutedForeground
  return (
    <View style={[styles.pill, { backgroundColor: bgColor + "22", borderColor: bgColor }]}>
      <View style={[styles.dot, { backgroundColor: bgColor }]} />
      <Text style={[styles.pillText, { color: bgColor }]}>{health}</Text>
    </View>
  )
}

interface PriorityTagPillProps {
  priority: "High" | "Mid" | "Low" | null | undefined
}

export function PriorityTagPill({ priority }: PriorityTagPillProps) {
  if (!priority) return null
  const colorMap: Record<string, string> = {
    High: "#ef4444",
    Mid: "#f97316",
    Low: "#22c55e",
  }
  const bgColor = colorMap[priority] ?? colors.mutedForeground
  return (
    <View style={[styles.pill, { backgroundColor: bgColor + "22", borderColor: bgColor }]}>
      <View style={[styles.dot, { backgroundColor: bgColor }]} />
      <Text style={[styles.pillText, { color: bgColor }]}>{priority}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 11,
    fontFamily: "InstrumentSans_500Medium",
    lineHeight: 16,
  },
})
