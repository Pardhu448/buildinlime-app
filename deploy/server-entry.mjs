// Production server entry.
//
// TanStack Start v1.132 emits a server-AGNOSTIC build: `dist/server/server.js`
// default-exports a `{ fetch(Request): Response }` handler and nothing more. It does
// not listen, and there is no Nitro preset to make it listen — running it directly
// exits 0 immediately. This file is the missing adapter.
//
// srvx supplies the Node listener and the static middleware. It arrived as a
// transitive dep of h3-v2 and is now declared explicitly in package.json, so a
// production install cannot drop it.
//
// ---------------------------------------------------------------------------
// Routing, and why page routes do NOT reach the handler
// ---------------------------------------------------------------------------
// vite.config.ts enables SPA mode: "emit a static, route-agnostic client-boot shell
// (dist/client/_shell.html) and serve it for every route … this only drops SSR from
// the public `/` and `/login` pages, which we don't server-render in prod."
//
// Handing a page route to the handler anyway makes it attempt an SSR render that the
// SPA build is not set up for, and it throws:
//
//   TypeError: Cannot read properties of undefined (reading 'state')
//     at getStartResponseHeaders (dist/server/server.js:574)
//
// So the order is: real file → server routes → shell.
//
//   1. static  — anything present in dist/client (hashed assets, icons, sw.js …)
//   2. handler — /api/* (all 19 server-route files live there: tRPC, better-auth,
//                the 15 Electric shape routes, resource upload/download) and
//                /_server* (TanStack server functions)
//   3. shell   — every other path, so direct URLs and refreshes boot the client
//
// See web-app/code/agentGuides/deploymentPlan.md §5.1.

import { readFileSync } from "node:fs"
import { serve } from "srvx"
import { serveStatic } from "srvx/static"
import handler from "./dist/server/server.js"

const port = Number(process.env.PORT ?? 3000)

// 0.0.0.0, not localhost — the process must be reachable from outside its container.
const hostname = process.env.HOST ?? "0.0.0.0"

// Read once: the shell is immutable for the lifetime of the image.
const shell = readFileSync("./dist/client/_shell.html")

/** Paths the server handler owns. Everything else is a client route. */
function isServerRoute(pathname) {
  return pathname.startsWith("/api/") || pathname.startsWith("/_server")
}

// srvx's static middleware has no MIME entry for .webmanifest and falls back to
// application/octet-stream, which browsers reject — the PWA becomes uninstallable.
// Patch the header on the way out rather than serving the file ourselves, so the
// middleware keeps owning caching and range handling.
const fixManifestType = async (request, next) => {
  const response = await next()
  if (!new URL(request.url).pathname.endsWith(".webmanifest")) return response
  const headers = new Headers(response.headers)
  headers.set("content-type", "application/manifest+json")
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

const server = serve({
  port,
  hostname,
  middleware: [fixManifestType, serveStatic({ dir: "./dist/client" })],
  fetch: (request) => {
    const { pathname } = new URL(request.url)
    if (isServerRoute(pathname)) return handler.fetch(request)
    // no-store: the shell references hashed assets, so a stale cached copy would
    // pin clients to a previous deploy's bundle.
    return new Response(shell, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    })
  },
})

await server.ready()
console.log(`buildinlime listening on http://${hostname}:${port}`)

// Compose/Docker stop sends SIGTERM. Without a handler Node exits non-zero after the
// grace period, which reads as a crash in `docker compose ps` and in restart policies.
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    server.close().then(
      () => process.exit(0),
      () => process.exit(1),
    )
  })
}
