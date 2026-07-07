// Post-build service-worker generation.
//
// vite-plugin-pwa does not emit a SW under TanStack Start's multi-build
// orchestration (there's no @vite-pwa integration for Start), so we run Workbox
// directly here. Crucially this runs AFTER `vite build` — i.e. after SPA-mode
// prerender has emitted dist/client/_shell.html — so the shell is included in
// the precache and can be used as the navigation fallback.
//
// The SW precaches the app shell + hashed client assets and serves _shell.html
// for any navigation that misses the cache, EXCEPT `/api/*` (auth/tRPC/Electric
// must always hit the network). Built with skipWaiting + clientsClaim so a new
// deploy takes over on the next load without reloading the active session.

import { generateSW } from 'workbox-build'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const clientDir = path.resolve(dir, '../dist/client')

const { count, size, warnings } = await generateSW({
  globDirectory: clientDir,
  globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,wasm,webmanifest}'],
  swDest: path.join(clientDir, 'sw.js'),
  navigateFallback: '/_shell.html',
  // Never hand the SPA shell to API/auth/sync requests — they must reach the
  // network and fail honestly offline, where the app's local-first layer takes
  // over.
  navigateFallbackDenylist: [/^\/api\//],
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  // The wa-sqlite wasm + main router chunk are large but needed offline.
  maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
})

for (const w of warnings) console.warn('[generate-sw]', w)
console.log(
  `[generate-sw] precached ${count} files (${(size / 1024 / 1024).toFixed(2)} MiB) -> dist/client/sw.js`,
)
