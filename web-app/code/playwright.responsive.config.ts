import { defineConfig, devices } from "@playwright/test"

// -----------------------------------------------------------------------------
// Responsive / layout E2E for the PUBLIC marketing pages.
//
// Deliberately a separate config from playwright.config.ts rather than another
// project inside it. That config's globalSetup seeds Postgres and signs a session
// cookie, so every project under it inherits a hard dependency on `pnpm e2e:up`.
// Nothing here is authenticated — these are the logged-out marketing routes — so
// paying for a database to assert a page does not scroll sideways would mean the
// check gets skipped locally, which is exactly when it needs to run.
//
// Run with: pnpm test:responsive
// -----------------------------------------------------------------------------

const BASE_URL = "http://localhost:3000"

export default defineConfig({
  testDir: "./tests/responsive",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    ignoreHTTPSErrors: true,
  },
  // The widths the layout has to survive: a phone and a tablet, both below the
  // lg: breakpoint (1024px) where the mobile rules apply, and a desktop above it
  // where the original design must be untouched.
  //
  // All Chromium. What these assert is layout at a given width and touch-target
  // geometry, neither of which is engine-specific, and requiring WebKit would
  // mean the suite does not run on a stock Linux checkout — `playwright install
  // webkit` additionally needs system libraries behind sudo. Set PW_WEBKIT=1 to
  // add a real Safari run, which is worth doing before a release: iOS is where
  // the safe-area insets and the input-zoom behaviour actually differ.
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    {
      name: "tablet",
      // Explicit rather than devices["iPad Mini"], which is WebKit-only.
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    ...(process.env.PW_WEBKIT
      ? [{ name: "mobile-ios", use: { ...devices["iPhone 13"] } }]
      : []),
  ],
  webServer: {
    command: "pnpm dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      // The marketing routes never touch the database, but the server module
      // graph is loaded eagerly and several modules construct clients at import
      // time (Resend in sendEmailOtp.ts, notably). These keep boot from throwing
      // on a machine with no .env and no docker stack running.
      DATABASE_URL: "postgresql://postgres:password@localhost:54322/electric",
      BETTER_AUTH_SECRET: "responsive-e2e-secret-min-32-chars-0001",
      BETTER_AUTH_URL: BASE_URL,
      RESEND_API_KEY: "re_responsive_dummy_not_used",
      NODE_ENV: "development",
      PORT: "3000",
      DISABLE_CADDY: "true",
    },
  },
})
