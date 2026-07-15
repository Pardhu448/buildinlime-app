// Shared domain constants and primitive types used across all domain modules.
// These do not depend on any infrastructure or framework.

export const MEMBERSHIP_ROLES = [`owner`, `co-owner`, `viewer`] as const
export type MembershipRole = typeof MEMBERSHIP_ROLES[number]

export const CHANNEL_NAMES = [
  "Finance",
  "Requirements",
  "Design",
  "Materials",
  "Tools",
  "Execution",
  "Experimentation",
] as const
export type ChannelName = typeof CHANNEL_NAMES[number]

export const PROPERTY_TYPES = [
  "priority",
  "status",
  "targetDate",
  "startDate",
  "pendingTask",
  "percent_complete",
  "label",
  "taskStatus",
] as const
export type PropertyType = typeof PROPERTY_TYPES[number]

// Whether a task is done. Only meaningful on entity "task", and the source of
// truth for `tasks.completed` — the properties tRPC router writes the column
// through in the same transaction, so the two cannot drift.
export const TASK_STATUS_VALUES = ["open", "completed"] as const
export type TaskStatusValue = typeof TASK_STATUS_VALUES[number]

// Per-user read state (the `reads` table). Unread is the ABSENCE of a row, so
// there is no "unread" member here — an item is read once a row exists for it.
// NOTE: web has cut over to the timestamp `seen_state` model below; the `reads`
// table/enum stays only while mobile finishes migrating.
export const READ_ITEM_TYPES = ["message", "task"] as const
export type ReadItemType = typeof READ_ITEM_TYPES[number]

// Per-user "last seen" markers (the `seen_state` table) — the timestamp
// successor to `reads`. One marker per (user, scope, scope_id): 'inbox' and
// 'mytasks' are singletons (scope_id ''), 'channel' has one marker per channel.
// An item is "unseen" iff it arrived after the marker for its view.
export const SEEN_SCOPES = ["inbox", "mytasks", "channel"] as const
export type SeenScope = typeof SEEN_SCOPES[number]

export const ENTITY_TYPES = ["project", "buildUnit", "channel", "task"] as const
export type EntityType = typeof ENTITY_TYPES[number]

export const STATUS_VALUES = ["critical", "high", "medium", "low"] as const
export type StatusValue = typeof STATUS_VALUES[number]

export const PRIORITY_VALUES = [
  "notStarted",
  "inProgress",
  "onTrack",
  "atRisk",
  "backLog",
  "overBudget",
  "onHold",
  "completed",
  "cancelled",
] as const
export type PriorityValue = typeof PRIORITY_VALUES[number]
