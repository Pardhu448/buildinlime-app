import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "node:path"
import { TEST_DATABASE_URL } from "./tests/integration/setup/config"

// Standalone test config — deliberately NOT importing the app's vite.config.ts.
//
// That config wires tanstackStart(), the Caddy plugin and the devtools plugin,
// none of which belong in a test run (tanstackStart hijacks routing and the
// prerender step). Vitest picks vitest.config.ts over vite.config.ts when both
// are present, so tests get this minimal setup: React/TSX transform plus the
// three path aliases the app uses (mirrors vite.config.ts `resolve.alias` and
// tsconfig `paths` — %/ was fixed in Phase 0).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/presentation"),
      "#": path.resolve(__dirname, "./src/presentation"),
      "%": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    // Vitest 3.2+ `projects`: one command, two environments.
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          include: [
            "src/**/*.test.{ts,tsx}",
            "tests/unit/**/*.test.{ts,tsx}",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          // Real migrated Postgres: create+migrate the test DB once (globalSetup),
          // truncate before each test (setupFiles). See tests/integration/setup.
          globalSetup: ["./tests/integration/setup/global.ts"],
          setupFiles: ["./tests/integration/setup/setup.ts"],
          // DATABASE_URL is read by the app's connection.ts when a router is
          // imported (Phase 3); point it at the test DB for the whole project.
          env: { DATABASE_URL: TEST_DATABASE_URL },
          // One shared database, mutated serially — never run files in parallel.
          fileParallelism: false,
        },
      },
    ],
  },
})
