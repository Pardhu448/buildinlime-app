// Pure builders for the Electric shape `where` clause (see ARCHITECTURE.md §4).
//
// The shape routes interpolate client-supplied ids straight into a SQL string
// that Electric runs against Postgres. The ONLY thing standing between that and
// SQL injection is UUID validation, and the default for an empty id set must be
// a hard `1 = 0` (default-deny — a user with no memberships sees zero rows, not
// every row). Both invariants are security-critical, so they live here as pure
// functions with unit tests rather than inline in a route handler.

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Parse a comma-separated id param, keeping ONLY well-formed UUIDs. Anything
 * else — empty strings, injection payloads, malformed ids — is dropped. Never
 * throws; a fully invalid input yields an empty array (→ default-deny below).
 */
export function parseIdList(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => UUID_REGEX.test(id))
}

/**
 * Build a `where` clause scoping `column` to `ids`. An empty list is
 * default-deny (`1 = 0`), NEVER an unscoped match. Ids are assumed already
 * UUID-validated by parseIdList (or DB-sourced); the `'...'` quoting is safe
 * only under that assumption, which is why the two are meant to be used together.
 *
 * Was two identical functions — this one and access-scope's idSetWhere — under
 * two names, one tested and one not. Now one.
 */
export function idSetWhere(column: string, ids: string[]): string {
  if (ids.length === 0) return `1 = 0`
  const quoted = ids.map((id) => `'${id}'`).join(`,`)
  return `${column} = ANY(ARRAY[${quoted}]::text[])`
}

/**
 * An id-set clause for use INSIDE an or() that already carries another
 * always-present access clause (e.g. `owner_id = me`). Empty set → empty string,
 * which or() drops.
 *
 * Contrast idSetWhere above, which yields `1 = 0` on an empty set. Use THAT one
 * wherever the id set is the only thing standing between the caller and the
 * table. Picking the wrong one is a default-open bug, which is why they have
 * deliberately different names.
 */
export function idSetOrOmit(column: string, ids: string[]): string {
  return ids.length === 0 ? `` : idSetWhere(column, ids)
}

// ---------------------------------------------------------------------------
// Combinators
//
// or() parenthesises whenever it joins more than one part; and() never does.
// That is not a style choice — it is exactly the SQL precedence rule. AND binds
// tighter than OR, so an or() nested inside an and() must be grouped (the
// `(owner OR member) AND project_id = …` case on /api/buildunits is the one that
// actually bites), while an and() nested inside an or() already binds correctly
// on its own.
//
// The payoff for and() staying bare is that every AND-shaped clause comes out
// byte-identical to what the hand-written routes emitted — including
// /api/memberships, whose whole design depends on its where string never
// changing (a changed string is a new Electric shape, a new handle, and a full
// refetch for every client).
//
// Both drop falsy parts. That is ONLY safe because every or() in ./shapes.ts
// retains at least one unconditional session-derived clause; see idSetOrOmit.
// ---------------------------------------------------------------------------

/**
 * A clause, or nothing. The falsy members let a conditional clause be written
 * inline — `projectId && \`project_id = '${projectId}'\`` — including the `null`
 * that URLSearchParams.get() returns for an absent param.
 */
export type Clause = string | false | null | undefined

function join(op: string, group: boolean, parts: Clause[]): string {
  const kept = parts.filter((p): p is string => Boolean(p))
  if (kept.length === 0) return `1 = 0` // default-deny, never an unscoped match
  if (kept.length === 1) return kept[0]
  const sql = kept.join(` ${op} `)
  return group ? `(${sql})` : sql
}

export const and = (...parts: Clause[]) => join(`AND`, false, parts)
export const or = (...parts: Clause[]) => join(`OR`, true, parts)

/** `col = '<session id>'`. */
export const isMe = (column: string, userId: string) => `${column} = '${userId}'`

/** Postgres array-contains, for `mention_ids @> [me]`. */
export const arrayContains = (column: string, value: string) =>
  `${column} @> ARRAY['${value}']::text[]`

export const notDeleted = `deleted_at IS NULL`
