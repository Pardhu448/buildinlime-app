import type { ByteRange } from "./provider"

// HTTP Range header parsing, deliberately in its OWN module rather than in
// fileStorage.ts.
//
// This is a pure function — a regex and some arithmetic, no I/O. fileStorage.ts
// imports `auth/server` and `database/connection`, and connection.ts THROWS at
// module load when DATABASE_URL is unset. So importing this function from there
// dragged the auth stack and a PG pool into anything that wanted to test it, and
// its unit test passed locally (a .env is present) while failing in CI, whose
// unit job is deliberately env-free: "Unit tests — web (jsdom) + mobile (node).
// No database needed."
//
// Keeping it here makes that CI invariant structurally true instead of
// accidentally maintained. `./provider` is types only (zero imports), so this
// module pulls in nothing at runtime.

/**
 * Parse a single-range HTTP `Range` header against a known object size.
 *   - null            → no (usable) Range header; serve the whole object (200).
 *   - "unsatisfiable" → a syntactically valid range that falls outside the file (416).
 *   - ByteRange       → the inclusive slice to serve (206).
 *
 * Only single ranges are handled; a multi-range header (a comma) is treated as
 * absent and the full object is served — media players only ever ask for one.
 */
export function parseRangeHeader(
  header: string | null,
  size: number
): ByteRange | "unsatisfiable" | null {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null
  const [, startStr, endStr] = match
  if (startStr === "" && endStr === "") return null

  let start: number
  let end: number
  if (startStr === "") {
    // Suffix form `bytes=-N`: the last N bytes.
    const suffix = Number(endStr)
    if (suffix === 0) return "unsatisfiable"
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(startStr)
    end = endStr === "" ? size - 1 : Number(endStr)
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  // A start at or past EOF cannot be served; an empty file satisfies no range.
  if (size === 0 || start >= size || start > end) return "unsatisfiable"
  if (end >= size) end = size - 1
  return { start, end }
}
