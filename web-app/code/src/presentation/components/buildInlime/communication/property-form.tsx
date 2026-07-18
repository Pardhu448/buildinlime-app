import { Input, Select } from "../shared/FormField"
import type { Property } from "%/domain/communication/types"
import { PROPERTY_TYPES, STATUS_VALUES, PRIORITY_VALUES, TASK_STATUS_VALUES } from "%/domain/shared/types"
import { STATUS_VALUE_LABELS, PRIORITY_LABELS, TASK_STATUS_LABELS } from "./PropertyPill"

// Full type labels used in the add-property form's type select (and the panel's
// property rows). The short pill labels live in PropertyPill as PILL_LABELS.
export const PROPERTY_TYPE_LABELS: Record<typeof PROPERTY_TYPES[number], string> = {
  status:           "Status",
  priority:         "Priority",
  targetDate:       "Target Date",
  startDate:        "Start Date",
  pendingTask:      "Pending Task",
  percent_complete: "Percent Complete",
  label:            "Label",
  taskStatus:       "Task Status",
}

// ── Form value state ──────────────────────────────────────────────────────────

export type ValueState = {
  statusValue:     typeof STATUS_VALUES[number];
  priorityValue:   typeof PRIORITY_VALUES[number];
  taskStatusValue: typeof TASK_STATUS_VALUES[number];
  dateValue:       string;
  textValue:       string;
  labelValue:      string;
}

export const DEFAULT_VALUE_STATE: ValueState = {
  statusValue:     "critical",
  priorityValue:   "notStarted",
  taskStatusValue: "open",
  dateValue:       "",
  textValue:       "",
  labelValue:      "",
}

/** Prefill the form with a property's current value, so re-setting a type edits
 *  it rather than starting from a blank default the user has to re-enter. */
export function valueStateFrom(property: Property | undefined): ValueState {
  if (!property) return DEFAULT_VALUE_STATE
  return {
    ...DEFAULT_VALUE_STATE,
    statusValue:     property.status_value ?? DEFAULT_VALUE_STATE.statusValue,
    priorityValue:   property.priority_value ?? DEFAULT_VALUE_STATE.priorityValue,
    taskStatusValue: property.task_status_value ?? DEFAULT_VALUE_STATE.taskStatusValue,
    dateValue:       property.target_date ?? property.start_date ?? "",
    textValue:       property.percent_complete ?? property.pending_task ?? "",
    labelValue:      property.label_value ?? "",
  }
}

// The per-type column set. Only the column a type owns is populated; the rest are
// nulled, so re-setting a type never leaves a stale value behind in a sibling
// column. (percent_complete has owned its own column since migration 0003 — it
// used to share `pending_task` with the pendingTask type.)
export type PropertyValues = {
  status_value:      typeof STATUS_VALUES[number]      | null;
  priority_value:    typeof PRIORITY_VALUES[number]    | null;
  task_status_value: typeof TASK_STATUS_VALUES[number] | null;
  target_date:       string | null;
  start_date:        string | null;
  pending_task:      string | null;
  percent_complete:  string | null;
  label_value:       string | null;
}

export function buildPropertyValues(
  selectedType: typeof PROPERTY_TYPES[number],
  valueState: ValueState,
): PropertyValues {
  const values: PropertyValues = {
    status_value:      null,
    priority_value:    null,
    task_status_value: null,
    target_date:       null,
    start_date:        null,
    pending_task:      null,
    percent_complete:  null,
    label_value:       null,
  }

  switch (selectedType) {
    case "status":           values.status_value      = valueState.statusValue;     break
    case "priority":         values.priority_value    = valueState.priorityValue;   break
    case "taskStatus":       values.task_status_value = valueState.taskStatusValue; break
    case "targetDate":       values.target_date       = valueState.dateValue;       break
    case "startDate":        values.start_date        = valueState.dateValue;       break
    case "pendingTask":      values.pending_task      = valueState.textValue;       break
    case "percent_complete": values.percent_complete  = valueState.textValue;       break
    case "label":            values.label_value       = valueState.labelValue;      break
  }

  return values
}

// ── Value input (one control per property type) ───────────────────────────────

export interface PropertyValueInputProps {
  selectedType: typeof PROPERTY_TYPES[number]
  valueState: ValueState
  setValueState: React.Dispatch<React.SetStateAction<ValueState>>
}

export function PropertyValueInput({ selectedType, valueState, setValueState }: PropertyValueInputProps) {
  switch (selectedType) {
    case "status":
      return (
        <Select
          value={valueState.statusValue}
          onChange={(e) => setValueState((v) => ({ ...v, statusValue: e.target.value as typeof STATUS_VALUES[number] }))}
        >
          {STATUS_VALUES.map((v) => (
            <option key={v} value={v}>{STATUS_VALUE_LABELS[v]}</option>
          ))}
        </Select>
      )
    case "priority":
      return (
        <Select
          value={valueState.priorityValue}
          onChange={(e) => setValueState((v) => ({ ...v, priorityValue: e.target.value as typeof PRIORITY_VALUES[number] }))}
        >
          {PRIORITY_VALUES.map((v) => (
            <option key={v} value={v}>{PRIORITY_LABELS[v]}</option>
          ))}
        </Select>
      )
    case "targetDate":
    case "startDate":
      return (
        <Input
          type="date"
          value={valueState.dateValue}
          onChange={(e) => setValueState((v) => ({ ...v, dateValue: e.target.value }))}
          required
        />
      )
    case "pendingTask":
      return (
        <Input
          type="text"
          value={valueState.textValue}
          onChange={(e) => setValueState((v) => ({ ...v, textValue: e.target.value }))}
          placeholder="Describe the pending task"
          required
        />
      )
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
      )
    case "taskStatus":
      return (
        <Select
          value={valueState.taskStatusValue}
          onChange={(e) => setValueState((v) => ({ ...v, taskStatusValue: e.target.value as typeof TASK_STATUS_VALUES[number] }))}
        >
          {TASK_STATUS_VALUES.map((v) => (
            <option key={v} value={v}>{TASK_STATUS_LABELS[v]}</option>
          ))}
        </Select>
      )
    case "label":
      return (
        <Input
          type="text"
          value={valueState.labelValue}
          onChange={(e) => setValueState((v) => ({ ...v, labelValue: e.target.value }))}
          placeholder="Enter label text"
          required
        />
      )
  }
}
