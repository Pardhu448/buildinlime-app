import { readFileSync } from "node:fs"
import path from "node:path"

// The shape global-setup writes to tests/e2e/.auth/seed.json.
export interface Seed {
  projectId: string
  buildUnitName: string
  channelName: string
  resourceName: string
  userA: { id: string; statePath: string }
  userB: { id: string; statePath: string }
}

export function readSeed(): Seed {
  const file = path.resolve(process.cwd(), "tests/e2e/.auth/seed.json")
  return JSON.parse(readFileSync(file, "utf8")) as Seed
}

/** The channel deep-link: /projects/:id/:buildUnitName/:channelName. */
export function channelUrl(s: Seed): string {
  return `/projects/${s.projectId}/${encodeURIComponent(
    s.buildUnitName,
  )}/${encodeURIComponent(s.channelName)}`
}
