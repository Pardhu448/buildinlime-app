import { defineConfig, devices } from "@playwright/test"
import path from "node:path"

// -----------------------------------------------------------------------------
// Web E2E (Phase 4 of agentGuides/testingAndCiSetup.md).
//
// The app is served in DEV mode (`vite dev`) rather than from a prod build: dev
// is the only serving path proven to run the /api routes (tRPC, Electric shapes,
// Better Auth) in this repo — there is no committed prod server preset yet
// (ARCHITECTURE.md §11). The offline spec exercises the optimistic OUTBOX (client
// JS), which behaves identically in dev; it only reloads AFTER reconnecting, so
// the prod-only service worker is not needed.
//
// Served over plain http://localhost:3000 (NOT the Caddy HTTPS origin): Chromium
// treats `localhost` as a secure context, so OPFS + crypto.subtle work, and with
// NODE_ENV != production Better Auth's cookies are non-secure, so they ride over
// http. The e2e Postgres+Electric stack must be up first (`pnpm e2e:up`).
// -----------------------------------------------------------------------------

const E2E_DB = "postgresql://postgres:password@localhost:54322/electric"
// Must be identical in globalSetup (which signs the session cookie) and the app
// (which verifies it). Kept here as the single source.
const E2E_SECRET = "e2e-better-auth-secret-min-32-chars-0001"
const BASE_URL = "http://localhost:3000"

// globalSetup runs in THIS process; seed it the same DB + secret the app uses.
process.env.DATABASE_URL ??= E2E_DB
process.env.TEST_DATABASE_URL ??= E2E_DB
process.env.BETTER_AUTH_SECRET ??= E2E_SECRET

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // The specs share one seeded channel and drive optimistic/offline state, so
  // run them serially rather than racing writes through one outbox.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    // Default context = user A. The two-user spec opens user B explicitly.
    storageState: path.resolve(process.cwd(), "tests/e2e/.auth/userA.json"),
    trace: "retain-on-failure",
    ignoreHTTPSErrors: true,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      DATABASE_URL: E2E_DB,
      USE_ELECTRIC_URL: "true",
      ELECTRIC_URL: "http://localhost:30001",
      BETTER_AUTH_SECRET: E2E_SECRET,
      BETTER_AUTH_URL: BASE_URL,
      // Keep out of production so useSecureCookies stays false (server.ts) and
      // the session cookie is accepted over http.
      NODE_ENV: "development",
      PORT: "3000",
    },
  },
})
