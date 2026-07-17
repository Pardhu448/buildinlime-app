import { useState, useRef, useEffect } from "react";
import type { FormEvent } from "react";
import { Plus, MoreHorizontal } from "lucide-react";
import { Modal } from "../shared/Modal";
import { Input, Select, Label } from "../shared/FormField";
import type { Property } from "%/domain/communication/types";
import { PROPERTY_TYPES, STATUS_VALUES, PRIORITY_VALUES, TASK_STATUS_VALUES, ENTITY_TYPES } from "%/domain/shared/types";
import { createPropertyAction, updatePropertyAction } from "%/application/actions/properties";
import { useSession } from "%/infrastructure/auth/client";
import { PropertyPill, TASK_STATUS_LABELS, STATUS_VALUE_LABELS, PRIORITY_LABELS } from "./PropertyPill";

export interface PropertiesInlineProps {
  properties: Property[];
  onAddProperty?: () => void;
  entityId: string;
  // The entity these properties belong to. Required so a caller can never
  // silently fall back to "buildUnit" and mis-scope a channel/task property.
  entity: typeof ENTITY_TYPES[number];
  // The enclosing channel's id. Required only for task-entity properties, whose
  // denormalized channel_id must be the task's channel (channel-entity
  // properties derive it from entity_id; build-unit/project have none).
  channelId?: string;
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
  taskStatus:       "Task Status",
}

type ValueState = {
  statusValue: typeof STATUS_VALUES[number];
  priorityValue: typeof PRIORITY_VALUES[number];
  taskStatusValue: typeof TASK_STATUS_VALUES[number];
  dateValue: string;
  textValue: string;
  labelValue: string;
};

const DEFAULT_VALUE_STATE: ValueState = {
  statusValue: "critical",
  priorityValue: "notStarted",
  taskStatusValue: "open",
  dateValue: "",
  textValue: "",
  labelValue: "",
};

/** Prefill the form with a property's current value, so re-setting a type edits
 *  it rather than starting from a blank default the user has to re-enter. */
function valueStateFrom(property: Property | undefined): ValueState {
  if (!property) return DEFAULT_VALUE_STATE;
  return {
    ...DEFAULT_VALUE_STATE,
    statusValue: property.status_value ?? DEFAULT_VALUE_STATE.statusValue,
    priorityValue: property.priority_value ?? DEFAULT_VALUE_STATE.priorityValue,
    taskStatusValue: property.task_status_value ?? DEFAULT_VALUE_STATE.taskStatusValue,
    dateValue: property.target_date ?? property.start_date ?? "",
    textValue: property.percent_complete ?? property.pending_task ?? "",
    labelValue: property.label_value ?? "",
  };
}

const VISIBLE_LIMIT = 4;

export function PropertiesInline({ properties, onAddProperty, entityId, entity, channelId }: PropertiesInlineProps) {
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

  // Every type stays offerable — picking one that already exists edits it in
  // place (see handleSubmit). Previously a set type was filtered out and could
  // never be changed, only deleted and re-added.
  //
  // taskStatus is the exception, and is NEVER offered — not even on a task. A
  // status change must be explained, and TaskStatusSection is the one control
  // that takes that note and posts it to the channel. Leaving taskStatus in this
  // generic form would be a second, silent way to complete a task with no note,
  // which is exactly the guarantee the note step exists to make.
  //
  // It is still a PROPERTY in the database — that is where status is stored, and
  // the properties router derives tasks.completed from it in the same transaction.
  // What is removed here is this component's ability to edit it, and (below) to
  // render its pill.
  const byType = new Map(properties.map((p) => [p.type, p]));
  const availableTypes = PROPERTY_TYPES.filter((t) => t !== "taskStatus");

  const openPopup = () => {
    const firstAvailable = availableTypes[0] ?? "status";
    setSelectedType(firstAvailable);
    setValueState(valueStateFrom(byType.get(firstAvailable)));
    setIsPopupOpen(true);
    onAddProperty?.();
  };

  const renderValueInput = () => {
    switch (selectedType) {
      case "status":
        return (
          <Select
            value={valueState.statusValue}
            onChange={(e) =>
              setValueState((v) => ({ ...v, statusValue: e.target.value as typeof STATUS_VALUES[number] }))
            }
          >
            {STATUS_VALUES.map((v) => (
              <option key={v} value={v}>{STATUS_VALUE_LABELS[v]}</option>
            ))}
          </Select>
        );
      case "priority":
        return (
          <Select
            value={valueState.priorityValue}
            onChange={(e) =>
              setValueState((v) => ({ ...v, priorityValue: e.target.value as typeof PRIORITY_VALUES[number] }))
            }
          >
            {PRIORITY_VALUES.map((v) => (
              <option key={v} value={v}>{PRIORITY_LABELS[v]}</option>
            ))}
          </Select>
        );
      case "targetDate":
      case "startDate":
        return (
          <Input
            type="date"
            value={valueState.dateValue}
            onChange={(e) => setValueState((v) => ({ ...v, dateValue: e.target.value }))}
            required
          />
        );
      case "pendingTask":
        return (
          <Input
            type="text"
            value={valueState.textValue}
            onChange={(e) => setValueState((v) => ({ ...v, textValue: e.target.value }))}
            placeholder="Describe the pending task"
            required
          />
        );
      case "label":
        return (
          <Input
            type="text"
            value={valueState.labelValue}
            onChange={(e) => setValueState((v) => ({ ...v, labelValue: e.target.value }))}
            placeholder="Enter label text"
            required
          />
        );
      case "percent_complete":
        return (
          <Input
            type="number"
            min="0"
            max="100"
            value={valueState.textValue}
            onChange={(e) => setValueState((v) => ({ ...v, textValue: e.target.value }))}
            placeholder="0–100"
            required
          />
        );
      case "taskStatus":
        return (
          <Select
            value={valueState.taskStatusValue}
            onChange={(e) =>
              setValueState((v) => ({ ...v, taskStatusValue: e.target.value as typeof TASK_STATUS_VALUES[number] }))
            }
          >
            {TASK_STATUS_VALUES.map((v) => (
              <option key={v} value={v}>{TASK_STATUS_LABELS[v]}</option>
            ))}
          </Select>
        );
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user || !entityId) return;

    setIsSubmitting(true);
    try {
      // Only the column this type owns is populated; the rest are nulled, so
      // re-setting a type never leaves a stale value behind in a sibling column.
      // NOTE percent_complete has its own column as of migration 0003 — it used
      // to share `pending_task` with the pendingTask type.
      const values = {
        status_value: null as typeof STATUS_VALUES[number] | null,
        priority_value: null as typeof PRIORITY_VALUES[number] | null,
        task_status_value: null as typeof TASK_STATUS_VALUES[number] | null,
        target_date: null as string | null,
        start_date: null as string | null,
        pending_task: null as string | null,
        percent_complete: null as string | null,
        label_value: null as string | null,
      };

      switch (selectedType) {
        case "status":
          values.status_value = valueState.statusValue;
          break;
        case "priority":
          values.priority_value = valueState.priorityValue;
          break;
        case "taskStatus":
          values.task_status_value = valueState.taskStatusValue;
          break;
        case "targetDate":
          values.target_date = valueState.dateValue;
          break;
        case "startDate":
          values.start_date = valueState.dateValue;
          break;
        case "pendingTask":
          values.pending_task = valueState.textValue;
          break;
        case "percent_complete":
          values.percent_complete = valueState.textValue;
          break;
        case "label":
          values.label_value = valueState.labelValue;
          break;
      }

      const existing = byType.get(selectedType);
      if (existing) {
        // Re-setting a type that is already present edits it in place, rather
        // than adding a second row of the same type.
        updatePropertyAction({ id: existing.id, patch: values });
      } else {
        createPropertyAction({
          id: crypto.randomUUID(),
          type: selectedType,
          entity,
          entity_id: entityId,
          // Denormalized channel scope for the properties shape: the channel
          // itself for channel props, the task's channel for task props, null for
          // build-unit/project props.
          channel_id:
            entity === "channel" ? entityId
            : entity === "task" ? (channelId ?? null)
            : null,
          ...values,
        });
      }
      setIsPopupOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // On a task, TaskStatusSection renders the status directly above this row — as a
  // control, not just a pill. Showing the pill here too would state the same fact
  // twice, one of them dead. Elsewhere taskStatus is meaningless anyway, so this is
  // simply "never render the taskStatus pill from the generic row".
  const shownProperties = properties.filter((p) => p.type !== "taskStatus");
  const visibleProperties = shownProperties.slice(0, VISIBLE_LIMIT);
  const hiddenProperties = shownProperties.slice(VISIBLE_LIMIT);

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

      <Modal
        open={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        title={byType.has(selectedType) ? "Set Property" : "Add Property"}
      >
            {(
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>
                    Property Type
                  </Label>
                  <Select
                    value={selectedType}
                    onChange={(e) => {
                      const next = e.target.value as typeof PROPERTY_TYPES[number];
                      setSelectedType(next);
                      // Prefill from the existing property so re-setting a type
                      // starts from its current value, not a blank default.
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
                  <Label>
                    Property Value
                  </Label>
                  {renderValueInput()}
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#976623] hover:bg-primary-hover disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {isSubmitting
                    ? "Saving…"
                    : byType.has(selectedType) ? "Update Property" : "Add Property"}
                </button>
              </form>
            )}
      </Modal>
    </>
  );
}
