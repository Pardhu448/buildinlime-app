import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { caddyPlugin } from "./vite-plugin-caddy"

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
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    caddyPlugin(),
    TanStackRouterVite({
      routesDirectory: './src/presentation/routes',
      generatedRouteTree: './src/presentation/routeTree.gen.ts',
    }),
    tanstackStart({
      srcDirectory: 'src/presentation',
    }),
    viteReact(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/presentation'),
      '#': path.resolve(__dirname, './src/presentation'),
      '%': path.resolve(__dirname, './src'),
    },
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
