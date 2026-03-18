export type Team = {
  id: string
  name: string
  description?: string | null
  owner_id: string
  project_id: string
  member_ids: string[]
  created_at: Date
}

export type UpdateTeam = {
  id?: string | null
  name?: string | null
  description?: string | null
  owner_id?: string | null
  project_id?: string | null
  member_ids?: string[] | null
  created_at?: Date | null
}

// User shape derived from the Better Auth users table (auth-schema.ts)
export type User = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  createdAt: Date
  updatedAt: Date
}
