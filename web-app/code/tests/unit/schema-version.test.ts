import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

// All Electric collections MUST share one schemaVersion. The persistence
// coordinator caches a single adapter keyed by that version; a lone differing
// value spawns a second adapter that hijacks the others' offset+data namespace —
// Electric reports "up-to-date" while the local store is empty and nothing
// renders. This has already happened once (ARCHITECTURE.md §7).
//
// Since the sync-core refactor the invariant is enforced by construction:
// every collection goes through defineCollection → makeCollectionOptionsBuilder,
// which stamps the single COLLECTION_SCHEMA_VERSION (sync-core/collections.ts) —
// deliberately NOT a per-collection parameter. What this guard pins is the one
// way left to break it: an app collection bypassing defineCollection and calling
// the tanstack builders directly with its own schemaVersion. So it scans BOTH
// apps' collection definitions (everything except each app's _shared.ts, which
// legitimately touches the builders once to inject them) for a schemaVersion
// literal or a direct persistence/electric-builder import.
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
)
const COLLECTION_DIRS = [
  path.join(repoRoot, "web-app/code/src/application/collections"),
  path.join(repoRoot, "mobile-app/src/application/collections"),
]

const collectionFiles = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && f !== "_shared.ts")
    .map((f) => path.join(dir, f))

describe("collection schemaVersion coupling", () => {
  it("no collection bypasses defineCollection with its own schemaVersion", () => {
    const files = COLLECTION_DIRS.flatMap(collectionFiles)
    // Sanity: the scan is looking at the real definitions, not an empty dir.
    expect(files.length).toBeGreaterThanOrEqual(6)

    const offenders: string[] = []
    for (const file of files) {
      const src = readFileSync(file, "utf8")
      if (/schemaVersion/i.test(src)) offenders.push(`${file}: schemaVersion literal`)
      if (/electric-db-collection|sqlite-persistence/.test(src))
        offenders.push(`${file}: direct tanstack builder import`)
    }
    expect(offenders).toEqual([])
  })
})
