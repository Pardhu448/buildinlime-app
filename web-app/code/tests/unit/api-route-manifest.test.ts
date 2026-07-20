import { describe, it, expect } from "vitest"
import { execFileSync } from "node:child_process"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

// scripts/generate-api-routes.mjs emits dist/server/api-routes.json, which the
// production entry (deploy/server-entry.mjs) uses to decide which /api paths may
// reach the TanStack handler.
//
// This matters because TanStack falls through to the SSR path when no server
// route matches, and this app builds in SPA mode — so the fall-through throws and
// an unknown /api path returned 500 instead of 404. Scanners probe /api/.env,
// /api/graphql and /api/config constantly; a 500 fills the logs and tells the
// prober something is listening.
//
// The failure mode to guard against is the generator silently producing garbage
// after a TanStack upgrade changes routeTree.gen.ts's format. An empty manifest
// would 404 every API route in production — worse than what it replaced.

const root = resolve(__dirname, "../..")
const routeTree = resolve(root, "src/presentation/routeTree.gen.ts")

/** Re-derive the manifest from source, independent of whether dist/ is built. */
function generate(): { count: number; routes: { path: string; pattern: string }[] } {
  execFileSync("node", ["scripts/generate-api-routes.mjs"], { cwd: root, stdio: "pipe" })
  return JSON.parse(readFileSync(resolve(root, "dist/server/api-routes.json"), "utf8"))
}

const distBuilt = existsSync(resolve(root, "dist/server"))

describe.skipIf(!distBuilt)("api route manifest", () => {
  const manifest = distBuilt ? generate() : { count: 0, routes: [] }
  const matches = (p: string) =>
    manifest.routes.some((r) => new RegExp(r.pattern).test(p))

  it("finds every server route file under routes/api", () => {
    // 19 route files today. The assertion is "non-trivially many", not an exact
    // count — adding a route should not break this test, but a format change
    // that silently yields nothing must.
    expect(manifest.count).toBeGreaterThanOrEqual(15)
    expect(routeTree).toBeTruthy()
  })

  it("matches exact routes", () => {
    expect(matches("/api/users")).toBe(true)
    expect(matches("/api/messages")).toBe(true)
    expect(matches("/api/resources")).toBe(true)
  })

  it("matches splat routes at any depth", () => {
    expect(matches("/api/auth/get-session")).toBe(true)
    expect(matches("/api/auth/callback/google")).toBe(true)
    expect(matches("/api/trpc/some.procedure")).toBe(true)
  })

  it("matches named params as exactly one segment", () => {
    expect(matches("/api/resources/abc-123/file")).toBe(true)
    // $resourceId must not swallow a slash
    expect(matches("/api/resources/abc/123/file")).toBe(false)
  })

  it("rejects the paths scanners probe", () => {
    for (const p of [
      "/api/.env",
      "/api/graphql",
      "/api/gql",
      "/api/config",
      "/api/user",
      "/api/v1/users",
    ]) {
      expect(matches(p), `${p} should not match`).toBe(false)
    }
  })

  it("rejects extra segments on an exact route", () => {
    expect(matches("/api/users/extra")).toBe(false)
    expect(matches("/api/")).toBe(false)
  })
})
