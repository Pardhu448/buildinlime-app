import { useState, useRef, useEffect } from "react";
import type { FormEvent } from "react";
import { Plus, X, MoreHorizontal, Circle, Flag, Target, CalendarDays, AlertCircle, Percent, Tag } from "lucide-react";
import type { Property } from "%/domain/communication/types";
import { PROPERTY_TYPES, STATUS_VALUES, PRIORITY_VALUES, ENTITY_TYPES } from "%/domain/shared/types";
import { propertiesCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections";
import { useSession } from "%/infrastructure/auth/client";

export interface PropertiesInlineProps {
  properties: Property[];
  onAddProperty?: () => void;
  buildUnitId: string;
  entity?: typeof ENTITY_TYPES[number];
}

// Short labels shown inside inline pills
const PILL_LABELS: Record<typeof PROPERTY_TYPES[number], string> = {
  status:           "Status",
  priority:         "Priority",
  targetDate:       "Target",
  startDate:        "Start",
  pendingTask:      "Pending",
  percent_complete: "% Done",
  label:            "Label",
}

// Full labels used in the add-property form selects
const PROPERTY_TYPE_LABELS: Record<typeof PROPERTY_TYPES[number], string> = {
  status:           "Status",
  priority:         "Priority",
  targetDate:       "Target Date",
  startDate:        "Start Date",
  pendingTask:      "Pending Task",
  percent_complete: "Percent Complete",
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

function PropertyPill({ property }: { property: Property }) {
  let icon: React.ReactNode
  let style: PillStyle = DEFAULT_PILL

  switch (property.type) {
    case "status": {
      style = STATUS_PILL_STYLES[property.status_value ?? ""] ?? DEFAULT_PILL
      icon = <Circle className={`w-3 h-3 shrink-0 ${style.text}`} fill="currentColor" />
      break
    }
    case "priority": {
      style = PRIORITY_PILL_STYLES[property.priority_value ?? ""] ?? DEFAULT_PILL
      icon = <Flag className={`w-3 h-3 shrink-0 ${style.text}`} />
      break
    }
    case "targetDate":
      icon = <Target className="w-3 h-3 shrink-0 text-green-600" />
      break
    case "startDate":
      icon = <CalendarDays className="w-3 h-3 shrink-0 text-blue-600" />
      break
    case "pendingTask":
      icon = <AlertCircle className="w-3 h-3 shrink-0 text-yellow-600" />
      break
    case "percent_complete":
      icon = <Percent className="w-3 h-3 shrink-0 text-[#976623]" />
      break
    case "label":
      icon = <Tag className="w-3 h-3 shrink-0 text-purple-600" />
      break
    default:
      return null
  }

  return (
    <div className={`flex items-center gap-1.5 px-2.5 h-7 min-w-[80px] ${style.bg} border ${style.border} rounded`}>
      {icon}
      <span className={`text-xs font-medium ${style.text} whitespace-nowrap`}>
        {PILL_LABELS[property.type]}
      </span>
    </div>
  )
}

type ValueState = {
  statusValue: typeof STATUS_VALUES[number];
  priorityValue: typeof PRIORITY_VALUES[number];
  dateValue: string;
  textValue: string;
  labelValue: string;
};

const DEFAULT_VALUE_STATE: ValueState = {
  statusValue: "critical",
  priorityValue: "notStarted",
  dateValue: "",
  textValue: "",
  labelValue: "",
};

const VISIBLE_LIMIT = 4;

export function PropertiesInline({ properties, onAddProperty, buildUnitId, entity = "buildUnit" }: PropertiesInlineProps) {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<typeof PROPERTY_TYPES[number]>("status");
  const [valueState, setValueState] = useState<ValueState>(DEFAULT_VALUE_STATE);
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  useEffect(() => {
    if (!showMore) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMore]);

  const existingTypes = new Set(properties.map((p) => p.type));
  const availableTypes = PROPERTY_TYPES.filter((t) => !existingTypes.has(t));

  const openPopup = () => {
    const firstAvailable = availableTypes[0] ?? "status";
    setSelectedType(firstAvailable);
    setValueState(DEFAULT_VALUE_STATE);
    setIsPopupOpen(true);
    onAddProperty?.();
  };

  const renderValueInput = () => {
    switch (selectedType) {
      case "status":
        return (
          <select
            value={valueState.statusValue}
            onChange={(e) =>
              setValueState((v) => ({ ...v, statusValue: e.target.value as typeof STATUS_VALUES[number] }))
            }
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
            onChange={(e) =>
              setValueState((v) => ({ ...v, priorityValue: e.target.value as typeof PRIORITY_VALUES[number] }))
            }
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
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user || !buildUnitId) return;
    if (existingTypes.has(selectedType)) return;

    setIsSubmitting(true);
    try {
      const base = {
        id: crypto.randomUUID(),
        type: selectedType,
        entity: entity,
        entity_id: buildUnitId,
        created_at: new Date(),
        status_value: undefined as typeof STATUS_VALUES[number] | undefined,
        priority_value: undefined as typeof PRIORITY_VALUES[number] | undefined,
        target_date: undefined as string | undefined,
        start_date: undefined as string | undefined,
        pending_task: undefined as string | undefined,
        label_value: undefined as string | undefined,
      };

      switch (selectedType) {
        case "status":
          base.status_value = valueState.statusValue;
          break;
        case "priority":
          base.priority_value = valueState.priorityValue;
          break;
        case "targetDate":
          base.target_date = valueState.dateValue;
          break;
        case "startDate":
          base.start_date = valueState.dateValue;
          break;
        case "pendingTask":
        case "percent_complete":
          base.pending_task = valueState.textValue;
          break;
        case "label":
          base.label_value = valueState.labelValue;
          break;
      }

      await propertiesCollection.insert(base);
      setIsPopupOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const visibleProperties = properties.slice(0, VISIBLE_LIMIT);
  const hiddenProperties = properties.slice(VISIBLE_LIMIT);

  return (
    <>
      <div className="flex items-center gap-4 mb-6 text-sm flex-wrap">
        <span className="text-[#717182]">Properties</span>
        <button
          className="p-1 text-[#717182] hover:text-[#1e1e1e] transition-colors"
          onClick={openPopup}
        >
          <Plus className="w-3 h-3" />
        </button>
        {visibleProperties.map((property) => (
          <PropertyPill key={property.id} property={property} />
        ))}
        {hiddenProperties.length > 0 && (
          <div ref={moreRef} className="relative">
            <button
              className="p-1 text-[#717182] hover:text-[#1e1e1e] transition-colors"
              onClick={() => setShowMore((v) => !v)}
              title={`${hiddenProperties.length} more`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMore && (
              <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg p-3 flex flex-col gap-2 min-w-max">
                {hiddenProperties.map((property) => (
                  <PropertyPill key={property.id} property={property} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Property Type
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Property Value
                  </label>
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
