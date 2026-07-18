import type { LucideIcon } from "lucide-react";
import { Circle, Flag, Target, CalendarDays, AlertCircle, Percent, Tag, CheckCircle2 } from "lucide-react";
import type { Property } from "%/domain/communication/types";
import { PROPERTY_TYPES, TASK_STATUS_VALUES } from "%/domain/shared/types";

// Short labels shown inside inline pills
export const PILL_LABELS: Record<typeof PROPERTY_TYPES[number], string> = {
  status:           "Status",
  priority:         "Priority",
  targetDate:       "Target",
  startDate:        "Start",
  pendingTask:      "Pending",
  percent_complete: "% Done",
  label:            "Label",
  taskStatus:       "Task Status",
}

export const TASK_STATUS_LABELS: Record<typeof TASK_STATUS_VALUES[number], string> = {
  open:      "Open",
  completed: "Completed",
}

export const STATUS_VALUE_LABELS: Record<string, string> = {
  critical: "Critical",
  high:     "High",
  medium:   "Medium",
  low:      "Low",
}

export const PRIORITY_LABELS: Record<string, string> = {
  notStarted:  "Not Started",
  inProgress:  "In Progress",
  onTrack:     "On Track",
  atRisk:      "At Risk",
  backLog:     "Backlog",
  overBudget:  "Over Budget",
  onHold:      "On Hold",
  completed:   "Completed",
  cancelled:   "Cancelled",
}

// The value a pill shows when asked to spell out its value rather than its type
// name (the build-units table and grid cards). Falls back to the type label when
// the value is unset.
function pillValueText(property: Property): string {
  switch (property.type) {
    case "status":           return STATUS_VALUE_LABELS[property.status_value ?? ""] ?? PILL_LABELS.status
    case "priority":         return PRIORITY_LABELS[property.priority_value ?? ""] ?? PILL_LABELS.priority
    case "targetDate":       return property.target_date || PILL_LABELS.targetDate
    case "startDate":        return property.start_date || PILL_LABELS.startDate
    case "pendingTask":      return property.pending_task || PILL_LABELS.pendingTask
    case "percent_complete": return property.percent_complete ? `${property.percent_complete}%` : PILL_LABELS.percent_complete
    case "label":            return property.label_value || PILL_LABELS.label
    case "taskStatus":       return TASK_STATUS_LABELS[property.task_status_value ?? "open"] ?? PILL_LABELS.taskStatus
  }
}

// The lucide icon for each property type — shared by the full pill and the
// icon-only display (channel cards).
const TYPE_ICON: Record<typeof PROPERTY_TYPES[number], LucideIcon> = {
  status:           Circle,
  priority:         Flag,
  targetDate:       Target,
  startDate:        CalendarDays,
  pendingTask:      AlertCircle,
  percent_complete: Percent,
  label:            Tag,
  taskStatus:       CheckCircle2,
}

export type PillStyle = { bg: string; border: string; text: string }

export const DEFAULT_PILL: PillStyle = { bg: "bg-icon-chip", border: "border-card-border", text: "text-foreground" }

export const STATUS_PILL_STYLES: Record<string, PillStyle> = {
  critical: { bg: "bg-red-100",    border: "border-red-200",    text: "text-red-700"    },
  high:     { bg: "bg-orange-100", border: "border-orange-200", text: "text-orange-700" },
  medium:   { bg: "bg-yellow-100", border: "border-yellow-200", text: "text-yellow-700" },
  low:      { bg: "bg-green-100",  border: "border-green-200",  text: "text-green-700"  },
}

export const PRIORITY_PILL_STYLES: Record<string, PillStyle> = {
  notStarted:  { bg: "bg-gray-100",   border: "border-gray-200",   text: "text-gray-600"   },
  inProgress:  { bg: "bg-blue-100",   border: "border-blue-200",   text: "text-blue-700"   },
  onTrack:     { bg: "bg-green-100",  border: "border-green-200",  text: "text-green-700"  },
  atRisk:      { bg: "bg-orange-100", border: "border-orange-200", text: "text-orange-700" },
  backLog:     { bg: "bg-gray-100",   border: "border-gray-200",   text: "text-gray-500"   },
  overBudget:  { bg: "bg-red-100",    border: "border-red-200",    text: "text-red-700"    },
  onHold:      { bg: "bg-yellow-100", border: "border-yellow-200", text: "text-yellow-700" },
  completed:   { bg: "bg-green-100",  border: "border-green-300",  text: "text-green-800"  },
  cancelled:   { bg: "bg-gray-100",   border: "border-gray-200",   text: "text-gray-400"   },
}

export const TASK_STATUS_PILL_STYLES: Record<string, PillStyle> = {
  open:      { bg: "bg-blue-100",  border: "border-blue-200",  text: "text-blue-700"  },
  completed: { bg: "bg-green-100", border: "border-green-300", text: "text-green-800" },
}

// Resolve the coloured icon + pill background style + label for a property.
// The value is conveyed through colour (status/priority/taskStatus); most pills
// show the type name, taskStatus spells its value out (it is load-bearing).
function pillVisual(property: Property): { icon: React.ReactNode; style: PillStyle; text: string } {
  const Icon = TYPE_ICON[property.type]
  let style: PillStyle = DEFAULT_PILL
  let text: string = PILL_LABELS[property.type]

  switch (property.type) {
    case "status":
      style = STATUS_PILL_STYLES[property.status_value ?? ""] ?? DEFAULT_PILL
      return { icon: <Icon className={`w-3 h-3 shrink-0 ${style.text}`} fill="currentColor" />, style, text }
    case "priority":
      style = PRIORITY_PILL_STYLES[property.priority_value ?? ""] ?? DEFAULT_PILL
      return { icon: <Icon className={`w-3 h-3 shrink-0 ${style.text}`} />, style, text }
    case "targetDate":
      return { icon: <Icon className="w-3 h-3 shrink-0 text-green-600" />, style, text }
    case "startDate":
      return { icon: <Icon className="w-3 h-3 shrink-0 text-blue-600" />, style, text }
    case "pendingTask":
      return { icon: <Icon className="w-3 h-3 shrink-0 text-yellow-600" />, style, text }
    case "percent_complete":
      return { icon: <Icon className="w-3 h-3 shrink-0 text-primary" />, style, text }
    case "label":
      return { icon: <Icon className="w-3 h-3 shrink-0 text-purple-600" />, style, text }
    case "taskStatus":
      style = TASK_STATUS_PILL_STYLES[property.task_status_value ?? ""] ?? DEFAULT_PILL
      text = TASK_STATUS_LABELS[property.task_status_value ?? "open"] ?? PILL_LABELS.taskStatus
      return { icon: <Icon className={`w-3 h-3 shrink-0 ${style.text}`} />, style, text }
  }
}

// showValue spells out the property's value (e.g. "On Track", "2026-08-15",
// "40%") instead of its type name. Defaults to the type name, which is what the
// inline property row on the build-unit/channel/task pages uses.
export function PropertyPill({ property, showValue = false }: { property: Property; showValue?: boolean }) {
  const { icon, style, text } = pillVisual(property)
  return (
    <div className={`flex items-center gap-1.5 px-2.5 h-7 min-w-[80px] ${style.bg} border ${style.border} rounded`}>
      {icon}
      <span className={`text-xs font-medium ${style.text} whitespace-nowrap`}>
        {showValue ? pillValueText(property) : text}
      </span>
    </div>
  )
}

