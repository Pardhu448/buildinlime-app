import { View, Text, StyleSheet } from "react-native"
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Circle,
  Flag,
  Percent,
  Tag,
  Target,
} from "lucide-react-native"
import type { LucideIcon } from "lucide-react-native"
import { colors } from "@/src/presentation/shared/colors"
import type { Property } from "@buildinlime/domain-types"

// Mirrors web's PropertiesInline pill (icons + colours). Web renders only the
// type label ("Target", "% Done"); on a card the value is what you actually want,
// so we show `label · value` where a value exists.

const STATUS_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#ca8a04",
  low: "#16a34a",
}

const PRIORITY_COLORS: Record<string, string> = {
  notStarted: "#4b5563",
  inProgress: "#1d4ed8",
  onTrack: "#15803d",
  atRisk: "#c2410c",
  backLog: "#6b7280",
  overBudget: "#b91c1c",
  onHold: "#a16207",
  completed: "#166534",
  cancelled: "#9ca3af",
}

const STATUS_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
}

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

interface Pill {
  icon: LucideIcon
  color: string
  text: string
  filled?: boolean
}

function toPill(property: Property): Pill | null {
  switch (property.type) {
    case "status": {
      if (!property.status_value) return null
      const color = STATUS_COLORS[property.status_value] ?? colors.mutedForeground
      return {
        icon: Circle,
        color,
        filled: true,
        text: STATUS_LABELS[property.status_value] ?? property.status_value,
      }
    }
    case "priority": {
      if (!property.priority_value) return null
      const color = PRIORITY_COLORS[property.priority_value] ?? colors.mutedForeground
      return {
        icon: Flag,
        color,
        text: PRIORITY_LABELS[property.priority_value] ?? property.priority_value,
      }
    }
    case "targetDate":
      if (!property.target_date) return null
      return { icon: Target, color: "#16a34a", text: property.target_date }

    case "startDate":
      if (!property.start_date) return null
      return { icon: CalendarDays, color: "#2563eb", text: property.start_date }

    case "pendingTask":
      if (!property.pending_task) return null
      return { icon: AlertCircle, color: "#ca8a04", text: property.pending_task }

    // percent_complete used to share the `pending_task` column with pendingTask.
    // It has its own column as of migration 0003, which also backfilled the
    // existing rows — so pending_task is now empty for this type.
    case "percent_complete":
      if (!property.percent_complete) return null
      return { icon: Percent, color: colors.primary, text: `${property.percent_complete}%` }

    case "label":
      if (!property.label_value) return null
      return { icon: Tag, color: "#9333ea", text: property.label_value }

    // Source of truth for task completion — the properties router writes
    // tasks.completed through in the same transaction, so this pill and the
    // My Tasks badge can never disagree.
    case "taskStatus": {
      if (!property.task_status_value) return null
      const done = property.task_status_value === "completed"
      return {
        icon: CheckCircle2,
        color: done ? "#166534" : "#1d4ed8",
        text: done ? "Completed" : "Open",
      }
    }

    default:
      return null
  }
}

export function PropertyPill({ property }: { property: Property }) {
  const pill = toPill(property)
  if (!pill) return null

  const { icon: Icon, color, text, filled } = pill

  return (
    <View style={[styles.pill, { backgroundColor: color + "1a", borderColor: color + "55" }]}>
      <Icon
        size={11}
        color={color}
        strokeWidth={2}
        {...(filled ? { fill: color } : {})}
      />
      <Text style={[styles.pillText, { color }]} numberOfLines={1}>
        {text}
      </Text>
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
    maxWidth: "100%",
  },
  pillText: {
    fontSize: 11,
    fontFamily: "InstrumentSans_500Medium",
    lineHeight: 16,
    flexShrink: 1,
  },
})
