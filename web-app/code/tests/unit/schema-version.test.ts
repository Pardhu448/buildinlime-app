import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

// All Electric collections MUST share one schemaVersion. The persistence
// coordinator caches a single adapter keyed by that version; bumping one
// collection spawns a second adapter that hijacks the others' offset+data
// namespace — Electric reports "up-to-date" while the local store is empty and
// nothing renders. This has already happened once (ARCHITECTURE.md §7).
//
// The per-collection constants are module-private, so this guard reads the
// source and asserts every numeric schemaVersion agrees — catching both a
// changed `const X_SCHEMA_VERSION = N` and an inline `schemaVersion: N`.
const collectionsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/application/collections",
)
const FILES = ["organization.ts", "communication.ts", "admin.ts"]

describe("collection schemaVersion coupling", () => {
  it("every collection declares the same schemaVersion", () => {
    const versions: string[] = []
    for (const file of FILES) {
      const src = readFileSync(path.join(collectionsDir, file), "utf8")
      for (const m of src.matchAll(/SCHEMA_VERSION\s*=\s*(\d+)/g)) versions.push(m[1])
      for (const m of src.matchAll(/schemaVersion:\s*(\d+)/g)) versions.push(m[1])
    }

    // Sanity: the regex actually found the declarations (there are 14 collections).
    expect(versions.length).toBeGreaterThanOrEqual(14)
    // The invariant: exactly one distinct version across all of them.
    expect(new Set(versions).size).toBe(1)
  })
})
