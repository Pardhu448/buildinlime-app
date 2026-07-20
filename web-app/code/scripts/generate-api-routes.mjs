// Emit dist/server/api-routes.json — the set of server routes the production
// entry (deploy/server-entry.mjs) is allowed to forward to the TanStack handler.
//
// WHY THIS EXISTS
// ---------------
// TanStack's handleServerRoutes matches a path, and when no server handler
// matches it falls through to executeRouter — the SSR path. This app builds in
// SPA mode (vite.config.ts `spa: { enabled: true }`), so there is no SSR set up,
// and that fall-through dies with:
//
//   TypeError: Cannot read properties of undefined (reading 'state')
//     at getStartResponseHeaders (dist/server/server.js:574)
//
// The visible symptom is that any unknown /api/* path returns 500 instead of 404.
// Internet scanners probe /api/.env, /api/graphql, /api/config constantly, so the
// logs fill with 500s and a 500 tells a prober that something is listening there.
//
// Rather than catching that error and guessing at its meaning — which couples us
// to TanStack internals — we derive the real route list from the generated route
// tree and refuse to forward anything else.
//
// Run as part of `pnpm build`, after vite has produced dist/.

import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const ROUTE_TREE = resolve(here, "../src/presentation/routeTree.gen.ts")
const OUT = resolve(here, "../dist/server/api-routes.json")

/**
 * Convert a TanStack route path to an anchored regex source.
 *   /api/users                       -> ^/api/users$
 *   /api/resources/$resourceId/file  -> ^/api/resources/[^/]+/file$
 *   /api/auth/$                      -> ^/api/auth(?:/.*)?$      (splat)
 */
function toRegexSource(routePath) {
  const segments = routePath.split("/").filter(Boolean)
  let out = ""
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    if (seg === "$") {
      // Trailing splat: matches /api/auth, /api/auth/, /api/auth/anything/deep
      out += "(?:/.*)?"
      return `^${out}$`
    }
    if (seg.startsWith("$")) {
      out += "/[^/]+" // named param — exactly one segment
    } else {
      out += "/" + seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    }
  }
  return `^${out}$`
}

const source = readFileSync(ROUTE_TREE, "utf8")

// Route paths appear as quoted literals in the generated tree. Pull the /api ones.
const paths = [...new Set(
  [...source.matchAll(/'(\/api\/[^']*)'/g)].map((m) => m[1]),
)].sort()

// Fail loudly. An empty manifest would make the entry 404 every API route, which
// is a far worse outcome than the 500s this replaces — and it would look like the
// app is broken rather than like the generator is.
if (paths.length === 0) {
  console.error(
    `[api-routes] No /api routes found in ${ROUTE_TREE}.\n` +
      `The generated route tree's format may have changed. Refusing to write an\n` +
      `empty manifest — deploy/server-entry.mjs would then reject every API call.`,
  )
  process.exit(1)
}

if (!existsSync(dirname(OUT))) {
  console.error(`[api-routes] ${dirname(OUT)} does not exist — run vite build first.`)
  process.exit(1)
}

const manifest = {
  generatedFrom: "src/presentation/routeTree.gen.ts",
  count: paths.length,
  routes: paths.map((p) => ({ path: p, pattern: toRegexSource(p) })),
}

writeFileSync(OUT, JSON.stringify(manifest, null, 2) + "\n")
console.log(`[api-routes] wrote ${paths.length} route patterns to dist/server/api-routes.json`)
