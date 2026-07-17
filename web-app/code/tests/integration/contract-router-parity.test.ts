import { describe, it, expect } from "vitest"
import { appRouter } from "%/infrastructure/trpc/routers/index"
// Deep import ON PURPOSE: the package root is type-only so mobile's Metro bundle
// never sees @trpc/server's runtime; the router VALUE lives on this subpath.
import { contractRouter } from "@buildinlime/contracts/router"

// The contracts package shares INPUT SCHEMAS with the server, so those cannot
// drift — but the procedure NAMES/namespaces in contractRouter are mirrored by
// hand (packages/contracts/src/router.ts). A renamed or moved server procedure
// would type-check on both sides and break mobile at runtime. This pins the one
// remaining drift channel: every contract procedure path must exist on the real
// server router. (The reverse is deliberately not asserted — web-only procedures
// like channels.addMember and users.* are not mirrored.)
//
// No database needed, but the server routers are integration-tier imports.

const procedurePaths = (router: { _def: { procedures: Record<string, unknown> } }) =>
  Object.keys(router._def.procedures).sort()

describe("contract router ↔ server appRouter parity", () => {
  it("every contract procedure exists on the server router", () => {
    const server = new Set(procedurePaths(appRouter))
    const contract = procedurePaths(contractRouter)

    // Sanity: the contract actually mirrors a meaningful surface.
    expect(contract.length).toBeGreaterThanOrEqual(15)

    const missing = contract.filter((path) => !server.has(path))
    expect(missing).toEqual([])
  })
})
