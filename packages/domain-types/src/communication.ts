import type {
  PropertyType,
  EntityType,
  StatusValue,
  PriorityValue,
  TaskStatusValue,
} from "./shared"

export type Task = {
  id: string
  name: string
  description: string
  completed: boolean
  opened_at: Date
  closed_at: Date
  channel_id: string
  buildunit_id: string
  createdby_id: string
  assignee_id?: string | null
  // Soft delete. Deleted tasks are filtered out of the Electric shape server-side,
  // so a client never receives one — this is here for completeness, not for the UI
  // to filter on.
  deleted_at?: Date | string | null
  deleted_by_id?: string | null
}

export type UpdateTask = {
  id?: string | null
  name?: string | null
  description?: string | null
  completed?: boolean | null
  opened_at?: Date | null
  closed_at?: Date | null
  channel_id?: string | null
  buildunit_id?: string | null
  createdby_id?: string | null
  assignee_id?: string | null
}

export type Message = {
  id: string
  text: string
  created_at: Date
  channel_id: string
  buildunit_id: string
  project_id: string
  createdby_id: string
  mention_ids: string[]
  resource_ids: string[]
  parent_id?: string | null
  // Set only on the note that accompanies a task status change. An ordinary
  // channel message that is ALSO addressable by task, so the task screen can list
  // its own status history without a separate table or shape.
  task_id?: string | null
  // Soft delete. A deleted message KEEPS SYNCING — its replies hang off it, and
  // dropping it would orphan the thread — but the server has REDACTED it: text is ""
  // and the id arrays are empty. Render a tombstone off this; never show the text.
  deleted_at?: Date | string | null
  deleted_by_id?: string | null
}

export type UpdateMessage = {
  id?: string | null
  text?: string | null
  created_at?: Date | null
  channel_id?: string | null
  buildunit_id?: string | null
  project_id?: string | null
  createdby_id?: string | null
  mention_ids?: string[] | null
  resource_ids?: string[] | null
  parent_id?: string | null
}

export type Resource = {
  id: string
  name: string
  description?: string | null
  file_location: string
  mime_type: string
  file_size_bytes: number
  uploaded_at: Date
  message_id?: string | null
  task_id?: string | null
  channel_id: string
  buildunit_id: string
  project_id: string
  createdby_id: string
  // Soft delete. Like tasks, filtered out of the Electric shape server-side, so a
  // client never receives one. The FILE ON DISK is not reclaimed.
  deleted_at?: Date | string | null
  deleted_by_id?: string | null
}

export type UpdateResource = {
  id?: string | null
  name?: string | null
  description?: string | null
  file_location?: string | null
  mime_type?: string | null
  file_size_bytes?: number | null
  uploaded_at?: Date | null
  message_id?: string | null
  task_id?: string | null
  channel_id?: string | null
  buildunit_id?: string | null
  project_id?: string | null
  createdby_id?: string | null
}

export type Property = {
  id: string
  type: PropertyType
  entity: EntityType
  entity_id: string
  status_value?: StatusValue | null
  priority_value?: PriorityValue | null
  task_status_value?: TaskStatusValue | null
  target_date?: string | null
  start_date?: string | null
  pending_task?: string | null
  // percent_complete formerly shared the `pending_task` column. It has its own
  // column as of migration 0003 — read it from here, not from pending_task.
  percent_complete?: string | null
  label_value?: string | null
  created_at: Date
}

export type UpdateProperty = {
  id?: string | null
  type?: PropertyType | null
  entity?: EntityType | null
  entity_id?: string | null
  status_value?: StatusValue | null
  priority_value?: PriorityValue | null
  target_date?: string | null
  start_date?: string | null
  pending_task?: string | null
  label_value?: string | null
  created_at?: Date | null
}
