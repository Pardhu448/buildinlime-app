import { useState } from "react"
import type { FormEvent } from "react"
import { Plus, Trash2, Circle, Flag, Target, CalendarDays, AlertCircle, Percent, Tag, CheckCircle2 } from "lucide-react"
import type { Property } from "%/domain/communication/types"
import { Modal } from "../shared/Modal"
import { Select, Label } from "../shared/FormField"
import { PROPERTY_TYPES } from "%/domain/shared/types"
import { createPropertyAction, updatePropertyAction, deletePropertyAction } from "%/application/actions/properties"
import { useSession } from "%/infrastructure/auth/client"
import {
  STATUS_VALUE_LABELS,
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  STATUS_PILL_STYLES,
  PRIORITY_PILL_STYLES,
  TASK_STATUS_PILL_STYLES,
  DEFAULT_PILL
  
} from "./PropertyPill"
import type {PillStyle} from "./PropertyPill";
import {
  PROPERTY_TYPE_LABELS,
  DEFAULT_VALUE_STATE,
  valueStateFrom,
  buildPropertyValues,
  PropertyValueInput
  
} from "./property-form"
import type {ValueState} from "./property-form";

export interface PropertiesPanelProps {
  properties: Property[];
  entityId: string;
  hideAddButton?: boolean;
  hideLabel?: boolean;
  label?: string;
}

// ── Value pill (right column) ─────────────────────────────────────────────────
// A smaller, value-spelling variant of PropertyPill: it shows "—" for an unset
// value (where PropertyPill falls back to the type name) and uses a tighter
// h-6/2.5 sizing, so it stays its own component rather than a PropertyPill flag.

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
      icon = <Percent className="w-2.5 h-2.5 shrink-0 text-primary" />
      // Own column as of migration 0003 — this used to read `pending_task`,
      // which it shared with the pendingTask type.
      label = `${property.percent_complete ?? "0"}%`
      break
    case "label":
      icon = <Tag className="w-2.5 h-2.5 shrink-0 text-purple-600" />
      label = property.label_value ?? "—"
      break
    case "taskStatus": {
      style = TASK_STATUS_PILL_STYLES[property.task_status_value ?? ""] ?? DEFAULT_PILL
      icon = <CheckCircle2 className={`w-2.5 h-2.5 shrink-0 ${style.text}`} />
      label = TASK_STATUS_LABELS[property.task_status_value ?? "open"] ?? "—"
      break
    }
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

// ── Main component ────────────────────────────────────────────────────────────

export function PropertiesPanel({ properties, entityId, hideAddButton = false, hideLabel = false, label = "Properties" }: PropertiesPanelProps) {
  const [isPopupOpen, setIsPopupOpen]   = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<typeof PROPERTY_TYPES[number]>("status");
  const [valueState, setValueState]     = useState<ValueState>(DEFAULT_VALUE_STATE);
  const { data: session } = useSession();

  const byType = new Map(properties.map((p) => [p.type, p]));
  // Every type stays offerable — picking one that already exists edits it.
  // NOTE this form is currently unreachable: every call site passes
  // hideAddButton, because `entity` below is hard-coded to "buildUnit" and no
  // channel_id is sent, so it would write mis-scoped rows on a task/channel.
  // Fix those two before un-hiding it anywhere.
  const availableTypes = PROPERTY_TYPES.filter((t) => t !== "taskStatus");

  const openPopup = () => {
    const firstAvailable = availableTypes[0] ?? "status";
    setSelectedType(firstAvailable);
    setValueState(valueStateFrom(byType.get(firstAvailable)));
    setIsPopupOpen(true);
  };

  const handleDelete = async (id: string) => {
    const tx = deletePropertyAction({ id });
    await tx.isPersisted.promise;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user || !entityId) return;

    setIsSubmitting(true);
    try {
      const values = buildPropertyValues(selectedType, valueState);

      const existing = byType.get(selectedType);
      if (existing) {
        updatePropertyAction({ id: existing.id, patch: values });
      } else {
        createPropertyAction({
          id: crypto.randomUUID(),
          type: selectedType,
          // Hard-coded, and the reason this form stays hidden — see openPopup.
          entity: "buildUnit",
          entity_id: entityId,
          ...values,
        });
      }
      setIsPopupOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div>
        {(!hideLabel || !hideAddButton) && (
          <div className="flex items-center justify-between mb-4">
            {!hideLabel && (
              <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
            )}
            {!hideAddButton && (
              <button
                onClick={openPopup}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {properties.length === 0 ? (
          <p className="text-sm text-muted-foreground">No properties added yet.</p>
        ) : (
          <div className="space-y-2">
            {properties.map((property) => (
              <div key={property.id} className="group flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground shrink-0">
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
      <Modal
        open={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        title={byType.has(selectedType) ? "Set Property" : "Add Property"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Property Type</Label>
            <Select
              value={selectedType}
              onChange={(e) => {
                const next = e.target.value as typeof PROPERTY_TYPES[number];
                setSelectedType(next);
                setValueState(valueStateFrom(byType.get(next)));
              }}
            >
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {PROPERTY_TYPE_LABELS[t]}{byType.has(t) ? " (set)" : ""}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Property Value</Label>
            <PropertyValueInput
              selectedType={selectedType}
              valueState={valueState}
              setValueState={setValueState}
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {isSubmitting
              ? "Saving…"
              : byType.has(selectedType) ? "Update Property" : "Add Property"}
          </button>
        </form>
      </Modal>
    </>
  );
}
