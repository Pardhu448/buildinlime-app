# Web E2E (Playwright)

Phase 4 of `agentGuides/testingAndCiSetup.md`. Drives the real browser + Electric
+ Postgres round trip — the only tier that covers the optimistic-outbox write path
(ARCHITECTURE.md §5) and cross-client sync (§4) end to end.

## What it does

- **`docker-compose.e2e.yaml`** — a dedicated, ephemeral Postgres + Electric stack
  (ports **54322 / 30001**), isolated from the dev stack so a run never touches dev
  data.
- **`global-setup.ts`** — migrates + seeds the e2e DB (reusing the integration
  harness) and writes an authenticated `storageState` per user. It bypasses the
  email-OTP login: it inserts a `sessions` row and signs the `better-auth`
  session cookie with `makeSignature` (better-auth's own primitive). No Resend.
- **`offline-sync.spec.ts`** — post online → go offline → create a task + delete a
  resource (optimistic) → reconnect → reload; assert everything drained and stuck.
- **`two-user-sync.spec.ts`** — A posts, B receives via Electric.

The app is served with `vite dev` on `http://localhost:3000` (not the prod build,
not Caddy) — see the header comment in `playwright.config.ts` for why.

## Run it locally

```bash
# from web-app/code
pnpm e2e:up                 # bring up the ephemeral Postgres+Electric stack (--wait)
pnpm exec playwright install chromium   # one-time: browser binary
pnpm test:e2e               # run the specs (starts the app itself)
pnpm test:e2e:ui            # or: interactive UI mode for debugging
pnpm e2e:down               # tear the stack down (removes volumes)
```

The HTML report lands in `playwright-report/`; traces are retained on failure.

## In CI

The `e2e` job in `.github/workflows/ci.yml` brings the stack up with
`docker compose … up -d --wait`, installs the browser, and runs `pnpm test:e2e`.
