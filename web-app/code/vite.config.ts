import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import fs from 'node:fs'
import path from 'node:path'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { caddyPlugin } from "./vite-plugin-caddy"

function serveOPFSWorker(): Plugin {
  const assetsDir = path.resolve(
    __dirname,
    '../../node_modules/@tanstack/browser-db-sqlite-persistence/dist/assets',
  )
  return {
    name: 'serve-opfs-worker',
    configureServer(server) {
      // Match the worker filename anywhere in the path. Older versions of
      // @tanstack/browser-db-sqlite-persistence resolved the worker to
      // `/assets/opfs-worker-<hash>.js`; from 0.1.9 onward Vite's dep
      // pre-bundler exposes it under `/node_modules/.vite/assets/...`.
      // We serve the file from the package's own dist/assets regardless.
      server.middlewares.use((req, res, next) => {
        const match = req.url?.match(/\/assets\/(opfs-worker-[^/?#]+\.js)(?:[?#]|$)/)
        if (match) {
          const filePath = path.join(assetsDir, match[1])
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/javascript')
            fs.createReadStream(filePath).pipe(res)
            return
          }
        }
        next()
      })
    },
  }
}

const config = defineConfig({
  server: {
    port: 3000,
    hmr: {
      // clientPort tells the browser where to connect for HMR (through Caddy).
      // Do NOT use `port` here — that would make Vite's HMR server claim port
      // 5173, blocking Caddy from binding to it for HTTPS.
      host: 'localhost',
      clientPort: 5173,
      protocol: 'wss',
    },
  },
  plugins: [
    serveOPFSWorker(),
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    // Caddy fronts dev with HTTPS at :5173. The plugin hard-exits if the `caddy`
    // binary is missing, so allow opting out (e.g. Playwright E2E in CI, which
    // hits http://localhost:3000 directly and needs no HTTPS front).
    ...(process.env.DISABLE_CADDY ? [] : [caddyPlugin()]),
    tanstackStart({
      srcDirectory: 'src/presentation',
      router: {
        routesDirectory: './routes',
        generatedRouteTree: './routeTree.gen.ts',
      },
      // SPA mode: emit a static, route-agnostic client-boot shell
      // (dist/client/_shell.html) and serve it for every route. This makes
      // direct-URL / refresh work for all routes online (server serves the
      // shell) and — paired with the service worker below — offline too. The
      // authenticated tree is already ssr:false; this only drops SSR from the
      // public `/` and `/login` pages, which we don't server-render in prod.
      spa: { enabled: true },
    }),
    viteReact(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/presentation'),
      '#': path.resolve(__dirname, './src/presentation'),
      '%': path.resolve(__dirname, './src'),
    },
    // Force a single copy of React across all packages in the monorepo.
    // Without this, pnpm's symlinked node_modules can cause Vite to bundle
    // multiple React instances, triggering "invalid hook call" errors.
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  root: '.',
  publicDir: 'public',
  
  optimizeDeps: {
    exclude: [`@tanstack/start-server-core`],
  },
  ssr: {
    // Keep server-only Node packages external so they are never bundled for the browser
    // better-auth must resolve its own nested @noble/ciphers@2 at runtime (the
    // hoisted root copy is v1 and lacks `managedNonce`), so keep it external
    // instead of bundling it into the server. Without this the built server
    // crashes on any auth crypto — and SPA prerender fails at build time.
    external: [`pg`, `pg-native`, `@dotenvx/dotenvx`, `drizzle-kit`, `better-auth`],
    noExternal: [`zod`, `drizzle-orm`],
  },
  
})

export default config
