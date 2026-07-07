import { useEffect } from 'react'

// Registers the Workbox service worker built by scripts/generate-sw.mjs. The SW
// precaches the app shell (dist/client/_shell.html) + hashed client assets and
// serves the shell as a navigation fallback, so hitting any route by direct URL
// or refresh works offline. Data stays local-first (Electric/OPFS); `/api/*` is
// never cached (navigateFallbackDenylist), so auth/tRPC/sync always hit the
// network. The SW is generated with skipWaiting+clientsClaim, so a new build
// takes over on the next load without reloading the current — possibly offline —
// session. No-op in dev (the SW only exists in production builds).
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (import.meta.env.DEV) return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.error('[pwa] service worker registration failed:', err)
    })
  }, [])

  return null
}
