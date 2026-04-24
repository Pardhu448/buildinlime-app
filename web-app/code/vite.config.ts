import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import fs from 'fs'
import path from 'path'

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
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/assets/opfs-worker-')) {
          const filename = req.url.split('/').pop()!
          const filePath = path.join(assetsDir, filename)
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
    caddyPlugin(),
    tanstackStart({
      srcDirectory: 'src/presentation',
      router: {
        routesDirectory: './routes',
        generatedRouteTree: './routeTree.gen.ts',
      },
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
    external: [`pg`, `pg-native`, `@dotenvx/dotenvx`, `drizzle-kit`],
    noExternal: [`zod`, `drizzle-orm`],
  },
  
})

export default config
