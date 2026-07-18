import { useState, useRef, useEffect } from "react"
import type { FormEvent } from "react"
import { Plus, MoreHorizontal } from "lucide-react"
import { Modal } from "../shared/Modal"
import { Select, Label } from "../shared/FormField"
import type { Property } from "%/domain/communication/types"
import type { ENTITY_TYPES } from "%/domain/shared/types";
import { PROPERTY_TYPES } from "%/domain/shared/types"
import { createPropertyAction, updatePropertyAction } from "%/application/actions/properties"
import { useSession } from "%/infrastructure/auth/client"
import { PropertyPill } from "./PropertyPill"
import {
  PROPERTY_TYPE_LABELS,
  DEFAULT_VALUE_STATE,
  valueStateFrom,
  buildPropertyValues,
  PropertyValueInput
  
} from "./property-form"
import type {ValueState} from "./property-form";

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user || !entityId) return;

    setIsSubmitting(true);
    try {
      const values = buildPropertyValues(selectedType, valueState);

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
        <span className="text-muted-foreground">Properties</span>
        <button
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
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
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Property Type</Label>
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
