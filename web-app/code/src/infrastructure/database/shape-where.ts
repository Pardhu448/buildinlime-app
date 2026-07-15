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
 * UUID-validated by parseIdList; the `'...'` quoting is safe only under that
 * assumption, which is why the two are meant to be used together.
 */
export function idListWhere(column: string, ids: string[]): string {
  if (ids.length === 0) return `1 = 0`
  const quoted = ids.map((id) => `'${id}'`).join(`,`)
  return `${column} = ANY(ARRAY[${quoted}]::text[])`
}
