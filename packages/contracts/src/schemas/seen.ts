import { z } from "zod"
import { SEEN_SCOPES } from "@buildinlime/domain-types"

// Wire contract for the per-user "last seen" marker. user_id is stamped
// server-side from the session — never sent by the client. scope_id is '' for the
// singleton inbox / mytasks scopes and the channel id for a channel; seen_at is an
// optional client timestamp (the server defaults to now() and keeps the GREATEST).
export const markSeenInput = z.object({
  scope: z.enum(SEEN_SCOPES),
  scope_id: z.string().default(``),
  seen_at: z.coerce.date().optional(),
})
