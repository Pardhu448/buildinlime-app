import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

// Every offline action module binds lazily to the executor and its collection,
// and exports a resetXActions() that clears those bindings so the next init can
// rebind. signOutAndDispose calls them through the barrel.
//
// This asserts the barrel covers the DIRECTORY, which is the failure mode that
// actually happened: the resets were enumerated by hand at the call site and had
// drifted to five of six — resetSeenActions was exported and never called, so
// markSeenAction kept pointing at the signed-out session's executor and
// collection. A behavioural test would not have caught that, because it would
// only have asserted the modules whoever wrote it already knew about.

const here = dirname(fileURLToPath(import.meta.url))
const actionsDir = join(here, "../../src/application/actions")

const modules = readdirSync(actionsDir)
  .filter((f) => f.endsWith(".ts") && f !== "index.ts")
  .map((f) => f.replace(/\.ts$/, ""))

const barrel = readFileSync(join(actionsDir, "index.ts"), "utf8")

describe("the offline-action barrel covers every action module", () => {
  it("finds the action modules on disk", () => {
    // Guards the guard: a bad path would make every assertion below vacuous.
    expect(modules.length).toBeGreaterThan(0)
  })

  for (const name of modules) {
    it(`${name} is imported and reset by resetAllOfflineActions`, () => {
      expect(barrel, `${name} is not imported by actions/index.ts`).toContain(
        `from "./${name}"`,
      )

      // Pull the reset identifier out of the import for this module, then
      // require the function body to call it — importing it is not enough.
      const importLine = barrel
        .split("\n")
        .find((l) => l.includes(`from "./${name}"`))
      const resetFn = importLine?.match(/import \{ (reset\w+) \}/)?.[1]
      expect(resetFn, `no resetXActions imported from ./${name}`).toBeDefined()

      const body = barrel.slice(barrel.indexOf("export function resetAllOfflineActions"))
      expect(body, `${resetFn}() is imported but never called`).toContain(
        `${resetFn}()`,
      )
    })
  }
})
