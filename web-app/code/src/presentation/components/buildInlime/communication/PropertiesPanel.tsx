import { useState } from "react";
import type { FormEvent } from "react";
import { Plus, X, Trash2, Circle, Flag, Target, CalendarDays, AlertCircle, Percent, Tag } from "lucide-react";
import type { Property } from "%/domain/communication/types";
import { PROPERTY_TYPES, STATUS_VALUES, PRIORITY_VALUES } from "%/domain/shared/types";
import { propertiesCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections";
import { useSession } from "%/infrastructure/auth/client";

export interface PropertiesPanelProps {
  properties: Property[];
  buildUnitId: string;
  hideAddButton?: boolean;
  hideLabel?: boolean;
  label?: string;
}

// ── Shared label maps ─────────────────────────────────────────────────────────

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  status:           "Status",
  priority:         "Priority",
  targetDate:       "Target Date",
  startDate:        "Start Date",
  pendingTask:      "Pending Task",
  percent_complete: "Percent Complete",
  label:            "Label",
}

const PILL_LABELS: Record<typeof PROPERTY_TYPES[number], string> = {
  status:           "Status",
  priority:         "Priority",
  targetDate:       "Target",
  startDate:        "Start",
  pendingTask:      "Pending",
  percent_complete: "% Done",
  label:            "Label",
}

const STATUS_VALUE_LABELS: Record<typeof STATUS_VALUES[number], string> = {
  critical: "Critical",
  high:     "High",
  medium:   "Medium",
  low:      "Low",
}

const PRIORITY_LABELS: Record<string, string> = {
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

// ── Pill styling (same palette as PropertiesInline) ───────────────────────────

type PillStyle = { bg: string; border: string; text: string }

const DEFAULT_PILL: PillStyle = { bg: "bg-[#f0e5d8]", border: "border-[#e5d4c1]", text: "text-[#1e1e1e]" }

const STATUS_PILL_STYLES: Record<string, PillStyle> = {
  critical: { bg: "bg-red-100",    border: "border-red-200",    text: "text-red-700"    },
  high:     { bg: "bg-orange-100", border: "border-orange-200", text: "text-orange-700" },
  medium:   { bg: "bg-yellow-100", border: "border-yellow-200", text: "text-yellow-700" },
  low:      { bg: "bg-green-100",  border: "border-green-200",  text: "text-green-700"  },
}

const PRIORITY_PILL_STYLES: Record<string, PillStyle> = {
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

// ── Value pill (right column) ─────────────────────────────────────────────────

function ValuePill({ property }: { property: Property }) {
  let icon: React.ReactNode
  let style: PillStyle = DEFAULT_PILL
  let label: string

  switch (property.type) {
    case "status": {
      style = STATUS_PILL_STYLES[property.status_value ?? ""] ?? DEFAULT_PILL
      icon = <Circle className={`w-2.5 h-2.5 shrink-0 ${style.text}`} fill="currentColor" />
      label = STATUS_VALUE_LABELS[property.status_value ?? ""] ?? "—"
      break
    }
    case "priority": {
      style = PRIORITY_PILL_STYLES[property.priority_value ?? ""] ?? DEFAULT_PILL
      icon = <Flag className={`w-2.5 h-2.5 shrink-0 ${style.text}`} />
      label = PRIORITY_LABELS[property.priority_value ?? ""] ?? "—"
      break
    }
    case "targetDate":
      icon = <Target className="w-2.5 h-2.5 shrink-0 text-green-600" />
      label = property.target_date ?? "—"
      break
    case "startDate":
      icon = <CalendarDays className="w-2.5 h-2.5 shrink-0 text-blue-600" />
      label = property.start_date ?? "—"
      break
    case "pendingTask":
      icon = <AlertCircle className="w-2.5 h-2.5 shrink-0 text-yellow-600" />
      label = property.pending_task ?? "—"
      break
    case "percent_complete":
      icon = <Percent className="w-2.5 h-2.5 shrink-0 text-[#976623]" />
      label = `${property.pending_task ?? "0"}%`
      break
    case "label":
      icon = <Tag className="w-2.5 h-2.5 shrink-0 text-purple-600" />
      label = property.label_value ?? "—"
      break
    default:
      return null
  }

  return (
    <div className={`flex items-center gap-1.5 px-2 h-6 ${style.bg} border ${style.border} rounded`}>
      {icon}
      <span className={`text-xs font-medium ${style.text} whitespace-nowrap`}>{label}</span>
    </div>
  )
}

// ── Add-property form (same logic as PropertiesInline) ────────────────────────

type ValueState = {
  statusValue:   typeof STATUS_VALUES[number];
  priorityValue: typeof PRIORITY_VALUES[number];
  dateValue:     string;
  textValue:     string;
  labelValue:    string;
}

const DEFAULT_VALUE_STATE: ValueState = {
  statusValue:   "critical",
  priorityValue: "notStarted",
  dateValue:     "",
  textValue:     "",
  labelValue:    "",
}

// ── Main component ────────────────────────────────────────────────────────────

export function PropertiesPanel({ properties, buildUnitId, hideAddButton = false, hideLabel = false, label = "Properties" }: PropertiesPanelProps) {
  const [isPopupOpen, setIsPopupOpen]   = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<typeof PROPERTY_TYPES[number]>("status");
  const [valueState, setValueState]     = useState<ValueState>(DEFAULT_VALUE_STATE);
  const { data: session } = useSession();

  const existingTypes  = new Set(properties.map((p) => p.type));
  const availableTypes = PROPERTY_TYPES.filter((t) => !existingTypes.has(t));

  const openPopup = () => {
    const firstAvailable = availableTypes[0] ?? "status";
    setSelectedType(firstAvailable);
    setValueState(DEFAULT_VALUE_STATE);
    setIsPopupOpen(true);
  };

  const handleDelete = async (id: string) => {
    const tx = propertiesCollection.delete(id);
    await tx.isPersisted.promise;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user || !buildUnitId) return;
    if (existingTypes.has(selectedType)) return;

    setIsSubmitting(true);
    try {
      const base = {
        id:             crypto.randomUUID(),
        type:           selectedType,
        entity:         "buildUnit" as const,
        entity_id:      buildUnitId,
        created_at:     new Date(),
        status_value:   undefined as typeof STATUS_VALUES[number]   | undefined,
        priority_value: undefined as typeof PRIORITY_VALUES[number] | undefined,
        target_date:    undefined as string | undefined,
        start_date:     undefined as string | undefined,
        pending_task:   undefined as string | undefined,
        label_value:    undefined as string | undefined,
      };

      switch (selectedType) {
        case "status":           base.status_value   = valueState.statusValue;   break;
        case "priority":         base.priority_value = valueState.priorityValue; break;
        case "targetDate":       base.target_date    = valueState.dateValue;     break;
        case "startDate":        base.start_date     = valueState.dateValue;     break;
        case "pendingTask":
        case "percent_complete": base.pending_task   = valueState.textValue;     break;
        case "label":            base.label_value    = valueState.labelValue;    break;
      }

      await propertiesCollection.insert(base);
      setIsPopupOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderValueInput = () => {
    switch (selectedType) {
      case "status":
        return (
          <select
            value={valueState.statusValue}
            onChange={(e) => setValueState((v) => ({ ...v, statusValue: e.target.value as typeof STATUS_VALUES[number] }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#976623] focus:border-transparent"
          >
            {STATUS_VALUES.map((v) => (
              <option key={v} value={v}>{STATUS_VALUE_LABELS[v]}</option>
            ))}
          </select>
        );
      case "priority":
        return (
          <select
            value={valueState.priorityValue}
            onChange={(e) => setValueState((v) => ({ ...v, priorityValue: e.target.value as typeof PRIORITY_VALUES[number] }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#976623] focus:border-transparent"
          >
            {PRIORITY_VALUES.map((v) => (
              <option key={v} value={v}>{PRIORITY_LABELS[v]}</option>
            ))}
          </select>
        );
      case "targetDate":
      case "startDate":
        return (
          <input
            type="date"
            value={valueState.dateValue}
            onChange={(e) => setValueState((v) => ({ ...v, dateValue: e.target.value }))}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#976623] focus:border-transparent"
          />
        );
      case "pendingTask":
        return (
          <input
            type="text"
            value={valueState.textValue}
            onChange={(e) => setValueState((v) => ({ ...v, textValue: e.target.value }))}
            placeholder="Describe the pending task"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#976623] focus:border-transparent"
          />
        );
      case "percent_complete":
        return (
          <input
            type="number"
            min="0"
            max="100"
            value={valueState.textValue}
            onChange={(e) => setValueState((v) => ({ ...v, textValue: e.target.value }))}
            placeholder="0–100"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#976623] focus:border-transparent"
          />
        );
      case "label":
        return (
          <input
            type="text"
            value={valueState.labelValue}
            onChange={(e) => setValueState((v) => ({ ...v, labelValue: e.target.value }))}
            placeholder="Enter label text"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#976623] focus:border-transparent"
          />
        );
    }
  };

  return (
    <>
      <div>
        {(!hideLabel || !hideAddButton) && (
          <div className="flex items-center justify-between mb-4">
            {!hideLabel && (
              <h3 className="text-sm font-medium text-[#717182]">{label}</h3>
            )}
            {!hideAddButton && (
              <button
                onClick={openPopup}
                className="p-1 text-[#717182] hover:text-[#1e1e1e] transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {properties.length === 0 ? (
          <p className="text-sm text-[#717182]">No properties added yet.</p>
        ) : (
          <div className="space-y-2">
            {properties.map((property) => (
              <div key={property.id} className="group flex items-center justify-between gap-3">
                <span className="text-sm text-[#717182] shrink-0">
                  {PROPERTY_TYPE_LABELS[property.type] ?? property.type}
                </span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <ValuePill property={property} />
                  <button
                    onClick={() => handleDelete(property.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-red-500"
                    title="Delete property"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Property popup — same form as PropertiesInline */}
      {isPopupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsPopupOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <button
              onClick={() => setIsPopupOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Add Property</h2>
            {availableTypes.length === 0 ? (
              <p className="text-sm text-[#717182]">All property types have already been added.</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                  <select
                    value={selectedType}
                    onChange={(e) => {
                      setSelectedType(e.target.value as typeof PROPERTY_TYPES[number]);
                      setValueState(DEFAULT_VALUE_STATE);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#976623] focus:border-transparent"
                  >
                    {availableTypes.map((t) => (
                      <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property Value</label>
                  {renderValueInput()}
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#976623] hover:bg-[#7d5419] disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {isSubmitting ? "Adding…" : "Add Property"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
