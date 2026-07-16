import { z } from "zod"
import {
  PROPERTY_TYPES,
  ENTITY_TYPES,
  STATUS_VALUES,
  PRIORITY_VALUES,
  TASK_STATUS_VALUES,
} from "@buildinlime/domain-types"

// Wire contracts for messages, resources and properties. See schemas/tasks.ts for
// the shared design.

// -------------------- messages --------------------

export const createMessageInput = z.object({
  id: z.string(),
  text: z.string().max(500),
  channel_id: z.string(),
  buildunit_id: z.string(),
  project_id: z.string(),
  createdby_id: z.string(),
  mention_ids: z.array(z.string()),
  resource_ids: z.array(z.string()),
  parent_id: z.string().nullish(),
  task_id: z.string().nullish(),
  // The client forwards its optimistic send time so the synced row keeps the
  // created_at the UI sorted on; omitted, the column defaults to now(). Rides the
  // outbox as an ISO string and is coerced back here.
  created_at: z.coerce.date().optional(),
})

// Soft delete redacts the row in place server-side; the client sends only the id.
export const deleteMessageInput = z.object({ id: z.string() })

// -------------------- resources --------------------

export const deleteResourceInput = z.object({ id: z.string() })

// -------------------- properties --------------------
// The jsonb value columns are typed as domain enums so the server's
// `.insert(...).values(input)` / `.set(input.data)` type-check against the table's
// $type<...> columns. createdby_id is intentionally absent — the server stamps it
// from the session, never trusting the client (it drives the properties shape's
// owner-escape clause).

export const createPropertyInput = z.object({
  id: z.string(),
  type: z.enum(PROPERTY_TYPES),
  entity: z.enum(ENTITY_TYPES),
  entity_id: z.string(),
  channel_id: z.string().nullish(),
  status_value: z.enum(STATUS_VALUES).nullish(),
  priority_value: z.enum(PRIORITY_VALUES).nullish(),
  task_status_value: z.enum(TASK_STATUS_VALUES).nullish(),
  target_date: z.string().nullish(),
  start_date: z.string().nullish(),
  pending_task: z.string().nullish(),
  percent_complete: z.string().nullish(),
  label_value: z.string().nullish(),
})

// Re-setting a property edits it in place. Only the value columns are mutable —
// type / entity / entity_id identify the property and must not change here.
export const propertyPatchInput = z.object({
  status_value: z.enum(STATUS_VALUES).nullish(),
  priority_value: z.enum(PRIORITY_VALUES).nullish(),
  task_status_value: z.enum(TASK_STATUS_VALUES).nullish(),
  target_date: z.string().nullish(),
  start_date: z.string().nullish(),
  pending_task: z.string().nullish(),
  percent_complete: z.string().nullish(),
  label_value: z.string().nullish(),
})

export const updatePropertyInput = z.object({ id: z.string(), data: propertyPatchInput })
export const deletePropertyInput = z.object({ id: z.string() })
