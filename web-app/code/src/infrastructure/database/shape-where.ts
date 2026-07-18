// Pure builders for the Electric shape `where` clause (see ARCHITECTURE.md §4).
//
// The builders interpolate ids straight into a SQL string that Electric runs
// against Postgres, so where those ids come from is the whole ballgame. Every
// id set now originates server-side, from resolveMemberScope off the session —
// no shape parses an id list out of the query string any more. (parseIdList,
// which existed to make client-supplied lists survivable, went with the last
// caller; git has it if the pattern ever comes back, but it should not.)
//
// The one remaining client-supplied value is /api/buildunits' `project_id`
// narrowing filter, which is UUID-validated with the regex below and AND-ed
// INSIDE the access boundary, so it can only restrict what the session already
// permits.
//
// The other invariant is default-deny: an empty id set must be a hard `1 = 0`,
// never an unscoped match. A user with no memberships sees zero rows.

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Build a `where` clause scoping `column` to `ids`. An empty list is
 * default-deny (`1 = 0`), NEVER an unscoped match. Ids are assumed DB-sourced
 * (resolveMemberScope) or UUID-validated; the `'...'` quoting is safe only under
 * that assumption.
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
