import type { ChannelName, MembershipRole } from "./shared"

export type Project = {
  id: string
  name: string
  description?: string | null
  created_at: Date
  priority?: "High" | "Mid" | "Low" | null
  target_date?: string | null
  owner_id: string
  status_percent?: string | null
}

export type UpdateProject = {
  id?: string | null
  name?: string | null
  description?: string | null
  created_at?: Date | null
  priority?: "High" | "Mid" | "Low" | null
  target_date?: string | null
  owner_id?: string | null
  status_percent?: string | null
}

export type BuildUnit = {
  id: string
  name: string
  description?: string | null
  health?: "On track" | "At risk" | "Off track" | null
  priority?: "High" | "Mid" | "Low" | null
  task_name?: string | null
  task_assignee?: string | null
  task_since?: string | null
  target_date?: string | null
  status_percent?: string | null
  project_id: string
  owner_id: string
  created_at: Date
}

export type UpdateBuildUnit = {
  id?: string | null
  name?: string | null
  description?: string | null
  health?: "On track" | "At risk" | "Off track" | null
  priority?: "High" | "Mid" | "Low" | null
  task_name?: string | null
  task_assignee?: string | null
  task_since?: string | null
  target_date?: string | null
  status_percent?: string | null
  project_id?: string | null
  owner_id?: string | null
  created_at?: Date | null
}

export type Channel = {
  id: string
  name: ChannelName
  description?: string | null
  buildunit_id: string
  owner_id: string
  created_at: Date
}

export type UpdateChannel = {
  id?: string | null
  name?: ChannelName | null
  description?: string | null
  buildunit_id?: string | null
  owner_id?: string | null
  created_at?: Date | null
}

export type Membership = {
  id: string
  user_id: string
  channel_id: string
  buildunit_id: string
  project_id: string
  member_flag: boolean
  role: MembershipRole
  created_at: Date
}
