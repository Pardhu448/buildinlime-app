import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "node:path"

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
          // The real Postgres harness + globalSetup land in Phase 2. Until a
          // spec exists, an empty run must pass rather than fail the suite.
          passWithNoTests: true,
          // Integration specs talk to a real DB; never run them in parallel
          // against the same schema.
          fileParallelism: false,
        },
      },
    ],
  },
})
