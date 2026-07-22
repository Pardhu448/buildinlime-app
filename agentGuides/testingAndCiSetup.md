# Testing & CI/CD Setup Roadmap — BuildInLime

Analysis of the current test/CI posture and a phased plan to add unit, integration,
and E2E testing plus a CI pipeline.

Derived 2026-07-15 against `main` (post the lazy-load / `seen_state` merge). Section
references like **§5** point at `ARCHITECTURE.md` at the repo root — the canonical
description of what runs today. This guide is the *how-we-verify-it* companion to
that doc; keep the two in step.

**Status (2026-07-19): ALL phases 0–6 are BUILT.** Landed across
`chore/typecheck-baseline` (Phase 0), `chore/test-runners` (Phases 1–3, 5),
`test/web-e2e-playwright` (Phase 4), and `chore/gcp-vm-deployment` (Phase 6).
§5 below marks each phase and records where the build diverged from the plan.

**Phase 6 was un-blocked, not re-decided.** It sat deferred on two architectural
constraints, and both were resolved rather than waived: `ARCHITECTURE.md` §12.1 (file
storage on the local filesystem) by the object-storage migration, and §12.3
(`ELECTRIC_INSECURE: true`) by the production Compose file deliberately omitting it.
The target is a single GCE VM, not the SST→AWS shape this doc originally guessed —
see `deploymentPlan.md`, which owns the deployment story end to end.

**Rebaselined 2026-07-16** after the contracts/sync-core refactor on
`fix/mobile-safe-area-and-resync` (shared `packages/contracts` +
`packages/sync-core`; mobile's `AppRouter` is now REALLY TYPED). **33 tests pass**
(web unit 14, mobile 6, web integration 13), build green, ratchet green. Net −3:
two guard tests were **deleted because their invariants are now enforced by
construction** (non-retriable parity ×2, see §3b) or **repurposed** (schemaVersion,
§3f), and one new parity test was added (contract↔server procedure names, §3b).
The baseline table and §5 reflect the post-refactor state.

**Changelog of the 2026-07-16 rebaseline** (each item is detailed in the section
it points at):

- **`schema-version.test.ts` repurposed** (§3f) — it was failing: the version moved
  into sync-core's single `COLLECTION_SCHEMA_VERSION`, so the old source-scraping
  regex found 0 literals. Now guards against `defineCollection` bypasses in both apps.
- **New `contract-router-parity.test.ts`** (§3b, integration tier) — pins the
  procedure-name drift channel the contracts package leaves open. Imports the
  router value from the `@buildinlime/contracts/router` subpath only (Metro gotcha
  in §5 Phase 3).
- **`appRouter` extracted** from `routes/api/trpc/$.ts` into
  `infrastructure/trpc/routers/index.ts` (§5 Phase 3 seams) so tests can import it
  without `createFileRoute`; the route file re-exports it, `trpc-client.ts` imports
  from the new location.
- **Ratchet baselines lowered** (§5 Phase 5) — web 232→224 type / 201→188 lint,
  mobile 57→34 / 5→4, locking in the refactor's cleanup per this guide's own
  watch-out.
- **`packages/*` gated** (§5 Phase 5) — `typecheck` scripts added to contracts,
  sync-core, domain-types; zero-count entries in `quality-baseline.json` +
  `ratchet.sh`, i.e. hard gates. No eslint config there yet, so no lint entries.

> `ARCHITECTURE.md` §12.7 already records the gap this guide closes: *"No automated
> test coverage of the sync, bootstrap, or offline paths. Vitest is configured; the
> intricate logic in §5 and §6 is currently protected only by its (excellent)
> comments."* This roadmap is the plan to replace comments with tests.

Baseline figures below were measured, not estimated — re-measure before acting, they
will have moved.

---

## 1. Baseline — the 2026-07-16 starting point

**Historical.** These are the figures the strategy below was designed against, kept
because the *shape* of the problem is what justifies the ratchet. For current numbers
see §5 Phase 5 — typecheck has since reached **0 everywhere** and is a hard gate, so
the asymmetry noted underneath now applies to web lint alone.

Measured across both workspaces:

| Gate | Status | Notes |
|---|---|---|
| `vite build` (web) | ✅ green | ~3s + prerender of `/` |
| `tsc --noEmit` (web) | ❌ 224 errors | was 232; the sync-core refactor deleted dirty code |
| `tsc --noEmit` (mobile) | ❌ 34 errors | was 57; `mutation-fns.ts` (the old hot spot) now delegates to sync-core |
| `tsc --noEmit` (packages/*) | ✅ 0 errors | contracts, sync-core, domain-types — born clean, hard-gated (Phase 5) |
| `eslint` (web) | ❌ 188 errors | packages/* have no eslint config yet — unlinted |
| `eslint` (mobile) | ❌ 4 errors | mostly unused vars / directives |
| Tests | ✅ 33 pass | web unit 14, mobile 6, web integration 13 |
| CI | ✅ | build, unit, integration, quality ratchet (Phase 5) |

**Key asymmetry: the build is green, typecheck/lint are red.** This dictates the
whole strategy — CI gates hard on build + tests, but typecheck and lint go on a
ratchet (§7 → §5 Phase 5), not a hard gate, or CI gets disabled in week two.

~~Mobile's tRPC client is typed `AppRouter = any`, so a server contract change
breaks mobile silently at runtime~~ — **fixed by the contracts refactor
(2026-07-16)**: `@buildinlime/contracts` exposes a stub `contractRouter` whose
input schemas are *shared with the server's routers*, and mobile's client is
`createTRPCProxyClient<AppRouter>` against its type. Input-shape drift is now a
compile error. The one channel left open — procedure *names* are mirrored by hand
in `contracts/src/router.ts` — is pinned by a parity test (§3b).

---

## 2. The `%` alias config bug — DONE (Phase 0)

**Landed in `chore/typecheck-baseline`.** Kept here as the record of what was wrong
and why the web error count moved.

`vite.config.ts` resolved three path aliases: `@` → `./src/presentation`,
`#` → `./src/presentation`, `%` → `./src`. But `tsconfig.json` only declared `@`
and `#`. So every `%/infrastructure/...` import (137 of them) was invisible to
TypeScript and silently typed `any` — the editor and any future CI were blind to an
entire layer, which per §12.4 is the same layer mobile has no types for at all.

The fix added `"%/*": ["./src/*"]` to tsconfig `paths` and a `typecheck` script
(`tsc --noEmit`) to both workspaces. Measured effect: unresolved `%` imports 137 → 0,
and web `tsc` errors 221 → **232** — the formerly-`any` imports now type-check for
real. This deliberately **surfaced** errors rather than fixing them; clearing them is
the ratchet's job (§5 Phase 5), not Phase 0's.

---

## 3. Where the risk actually lives

Presentation is ~17k LOC; the *logic* is small and unusually well-seamed. The
architecture doc points a flashing arrow at the two subsystems that carry the risk —
the write path (§5) and the bootstrap (§6) — and both are cheap to test.

### 3a. Membership-driven authorization (highest value)
Membership is **the authorization primitive** (§1): everything a user can see or
mutate derives from `memberships` rows plus an "I own it" escape clause, re-verified
server-side **per shape and per tRPC mutation** (§5, §9). This is the single most
important invariant in the system, and it is enforced in three independent places
that must agree:

1. **Shape routes** (`routes/api/*.ts`, §4) — a user with no memberships gets
   `where 1 = 0`; ids are validated as UUIDs before interpolation.
2. **tRPC mutations** (`trpc/routers/*.ts`, §5) — e.g. `messages.delete` checks
   `createdby_id === session.user.id`; `resources.delete` allows uploader **or** the
   task's creator.
3. **File downloads** (`/api/resources/:id/file`, §8) — re-checks session, rejects
   soft-deleted resources, and verifies an active membership in the resource's
   channel. Deliberately not belt-and-braces: the file outlives its soft delete on
   disk and the id is not a secret.

`Context` is literally `{ session, db }` (`trpc/lib/trpc.ts`), so routers can be
called directly with a fabricated context — no HTTP, no mocking — against a real
Postgres. This is the highest-leverage tier in the codebase.

### 3b. The write path's safety properties (§5)
Three properties keep the optimistic-outbox scheme correct, and each is a test target:

- **Idempotency everywhere** — every create is `ON CONFLICT DO NOTHING` + re-select;
  every delete is a no-op if already deleted. The outbox retries; a retry must never
  double-insert or 500.
- **Non-retriable errors fail fast** — `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`,
  `NOT_FOUND`, `CONFLICT`, `PRECONDITION_FAILED`, `PAYLOAD_TOO_LARGE`,
  `UNPROCESSABLE_CONTENT` are wrapped as `NonRetriableError` and dropped, or they
  wedge the FIFO outbox forever. **This set drifted once** — `CONFLICT` was in
  mobile's set and missing from web's (§10). *(2026-07-16)* The parity tests that
  guarded this were **deleted**: both apps' `mutation-fns` now derive their Set
  from the canonical `NON_RETRIABLE_TRPC_CODES` in `@buildinlime/domain-types`
  (`new Set(NON_RETRIABLE_TRPC_CODES)`), so the invariant is enforced by
  construction. Prefer that pattern over a parity test whenever a refactor makes
  it available. (Since the sync-core refactor the whole outbox spine lives once in
  `packages/sync-core/src/mutation-fns.ts` anyway.)
- **Contract-name parity (new, replaces the drift risk class above)** — the
  contracts package shares input *schemas* with the server, but the procedure
  *names/namespaces* in `contracts/src/router.ts` are mirrored by hand; a renamed
  server procedure would type-check on both sides and break mobile at runtime.
  `tests/integration/contract-router-parity.test.ts` asserts every contract
  procedure path exists on the real `appRouter`. (One-directional on purpose:
  web-only procedures like `channels.addMember` and `users.*` are not mirrored.)
- **`createTask` auto-suffixes on `CONFLICT`** — "Site Survey" → "Site Survey (2)",
  retrying up to 50 times, because a conflict means the task was created offline and
  someone took the name before it replayed. Safe only because the id is
  client-generated and unchanged. Worth pinning; it is subtle and easy to break.

### 3c. The bootstrap "trustworthy result" logic (§6)
The most intricate code in the system, and nearly pure. `collection.isReady()` does
**not** mean "synced" — the Electric library calls `markReady()` from its error path
too, so a memberships shape that 401s lands on "ready + 0 rows" indistinguishable
from a genuine new user. Derive id sets from that and every channel-scoped shape
becomes `1 = 0` for the whole session. The out-of-band error tracking
(`membershipsShapeErrored` / `clearMembershipsShapeError`) is what distinguishes
the two cases. It is small, side-effect-light, and load-bearing — an ideal unit
test. *(2026-07-16)* The implementation now lives in
`packages/sync-core/src/collections.ts` (`makeShapeRetry`, a per-app singleton
each `collections/_shared.ts` instantiates once); the unit test still exercises it
through web's `_shared.ts` re-exports, which is the surface the bootstrap uses.

### 3d. Offline / sync machinery
`mobile-app/src/infrastructure/offline/upload-manager.ts` (507 LOC) is a state
machine: re-entrancy guard (`inFlight`), exponential backoff capped at 30s
(`MAX_BACKOFF_MS`, `MAX_AUTO_RETRIES = 5`), offline-vs-error status mapping, and
hydration that resumes interrupted uploads (§8). Every dependency
(`expo-file-system`, `cookie-fetch`, `online-detector`, `pending-uploads-db`) is a
module import → trivially mockable, and fake timers exercise the whole retry ladder
in ms. The custom `OnlineDetector` (§10) — which notifies *after* updating state,
unlike the library's — is also unit-sized and its bug was real.

### 3e. Electric shape SQL guard (security, §4)
Shape routes interpolate channel IDs into an Electric `where` string. The only
defense against SQL injection is `UUID_REGEX`, and the default-deny is a literal
`1 = 0`. Correct today; deserves a test that fails loudly if anyone relaxes the regex
or the empty-set default.

### 3f. Config-coupling footguns (cheap guard tests)
Two invariants the architecture flags as "already went wrong once":

- **All collections must share one `schemaVersion`** (§7, currently 3). Bumping one
  spawns a second persistence adapter and silently zeroes the store. *(2026-07-16)*
  Now enforced by construction: every collection in BOTH apps goes through
  `defineCollection` → sync-core's `makeCollectionOptionsBuilder`, which stamps the
  single `COLLECTION_SCHEMA_VERSION` (`packages/sync-core/src/collections.ts`) —
  deliberately not a per-collection parameter. The guard test was **repurposed**,
  not deleted: it now scans both apps' collection files for the one escape hatch
  left (a bypass of `defineCollection` declaring its own `schemaVersion` or
  importing the tanstack builders directly).
- **Soft-delete non-uniformity** (§4) — tasks/resources filter `deleted_at` out of
  the shape; **messages redact in place** (`text`, `mention_ids`, `resource_ids`
  cleared) so replies aren't orphaned. An integration test on `messages.delete`
  asserting the row survives *and* the words are gone protects a genuinely
  counter-intuitive rule.

---

## 4. Decisions taken

Confirmed with the maintainer 2026-07-15:

- **Red baseline → ratchet on changed files.** CI fails only on typecheck/lint
  errors in files a PR touches; total debt shrinks as code is touched. Fix the `%`
  alias first (§2) — done.
- **E2E → Playwright, web only.** Offline sync (§5, §6) is the differentiating
  feature and lives on web; mobile's risky logic is the offline layer, already
  covered by units.
- **First pass → full scaffold + one exemplar test per tier** as copy-templates.
- **Mobile unit tests use Vitest in node env with Expo modules mocked — NOT
  `jest-expo`.** The offline layer is pure TS; a second runner buys nothing.
  RN component *rendering* is deliberately out of scope (would need `jest-expo` +
  Testing Library Native).

---

## 5. Phased plan

### Phase 0 — config fix (§2 of this guide) — ✅ DONE
tsconfig `%` alias + `typecheck` scripts. Landed standalone in
`chore/typecheck-baseline`.

### Phase 1 — test runners — ✅ DONE
- **Web** `vitest.config.ts` uses Vitest 3.2 `projects`: `unit` (jsdom,
  `src/**` + `tests/unit/**`) and `integration` (node, `tests/integration/**`).
  **Standalone config** — deliberately NOT importing the app `vite.config.ts`, whose
  `tanstackStart`/Caddy plugins break a test run. Aliases `@`/`#`/`%` mirror the app.
- **Mobile** `vitest.config.ts`: node env, `@` alias to root; Expo/RN modules mocked
  per-test with `vi.mock` (not global aliases). New devDeps: `vitest`,
  `@vitest/coverage-v8`.
- Root scripts: `test`, `test:unit`, `test:integration`, `test:e2e` (Phase 4 stub),
  `typecheck`, `lint`.

**Diverged from plan:** (1) `test:unit`/`test:integration` call **named scripts** in
the web package (`vitest run --project unit`), not `pnpm exec vitest --project …` —
`pnpm exec` mangled the `--project` arg. (2) Per-project `passWithNoTests` is NOT
honored when a project runs in isolation, so `integration` needs at least one file
to exist rather than relying on that flag.

### Phase 2 — integration harness (real Postgres) — ✅ DONE
`tests/integration/setup/` targets a **separate `buildinlime_test` DB** on the compose
Postgres (dev port 54321; CI 5432) so dev data is never touched.
- `config.ts` — DB coordinates, import-light so `vitest.config` can read
  `TEST_DATABASE_URL`; overridable via `process.env.TEST_DATABASE_URL` (CI sets it).
- `global.ts` (globalSetup, once) — `CREATE DATABASE` if absent, then drizzle
  `migrate` (`web-app/code/drizzle/`).
- `db.ts` — test drizzle handle + `resetDb()` (**catalog-driven** `TRUNCATE` of every
  `public` table, so a new table can't escape) + `closeDb()`. Pool is **`max: 1`**
  (see Phase 3 deadlock note).
- `setup.ts` (setupFiles) — truncate `beforeEach`, close pool `afterAll`.
- `ctx.ts` — `makeCtx(user)` / `makeAnonCtx()` → a real tRPC `Context` (`{ session,
  db }`). Session is a **structural cast** (`as unknown as Context`); `isAuthed` only
  reads `session.user.id`, so no need to import better-auth's session type.
- `factories.ts` — faker insert-and-return factories for user/project/buildunit/
  channel/**membership**/task/message/resource, plus `seedChannel`/`addMember`
  composites. Because membership *is* authz (§3a), seeding the right membership rows
  is most of the setup.

Routers use `ctx.db` exclusively, so `router.createCaller(makeCtx(user))` drives real
mutations against the test DB. `env: { DATABASE_URL: TEST_DATABASE_URL }` on the
integration project points the app's `connection.ts` at the test DB when a router is
imported. Electric not needed at this tier — DB only.

### Phase 3 — exemplar tests (one per tier + the cheap guards) — ✅ DONE (33 tests)

*(2026-07-16: the list below is updated for the contracts/sync-core refactor —
struck-through items were deleted/repurposed when their invariant became enforced
by construction; the contract-parity spec is new.)*
- **Integration — `resources.delete` authz** (§3a): uploader deletes; task creator
  deletes someone else's attachment; unrelated user → `FORBIDDEN`; unknown id →
  `NOT_FOUND`; re-delete idempotent, `deleted_at` unchanged; row survives, bytes
  untouched.
- **Integration — `messages.delete` redaction** (§3f): row survives, but `text` /
  `mention_ids` / `resource_ids` are cleared and `deleted_at` set; attachments
  soft-deleted; non-author → `FORBIDDEN`. Proves the "tombstone, not deletion" rule.
- **Unit — shape SQL guard** (`shape-where.ts`, §3e): empty set → exactly `1 = 0`;
  valid UUIDs → `ANY(ARRAY[...])`; injection payload (`'; DROP TABLE messages;--`)
  filtered out; parse+build together collapses an attack to default-deny.
- ~~**Unit — non-retriable-set parity** (§3b)~~ **DELETED 2026-07-16**: both sets
  are now derived from `NON_RETRIABLE_TRPC_CODES` at construction; nothing left to
  assert.
- **Integration — contract-router name parity** (§3b, **new 2026-07-16**): every
  procedure path in `contractRouter` exists on the real server `appRouter`. Sits in
  the integration project because importing the server routers is that tier's remit
  (no DB rows touched). **Gotcha, learned the hard way:** the test imports the
  router VALUE from the `@buildinlime/contracts/router` *subpath*, never the package
  root. The root is type-only on purpose — mobile's Metro bundler does not
  tree-shake, so a root value export of the router drags `@trpc/server`'s runtime
  into the RN bundle, which throws "You're trying to use @trpc/server in a
  non-server environment" on device.
- **Unit — bootstrap error tracking** (§3c; logic now in sync-core's
  `makeShapeRetry`, tested through web's `_shared.ts` re-exports):
  `membershipsShapeErrored()` false after a clean start, true synchronously after
  `retryOnMembershipsError`, reset by `clearMembershipsShapeError`.
- **Unit — `schemaVersion` guard** (§3f, **repurposed 2026-07-16**): the version is
  the single `COLLECTION_SCHEMA_VERSION` in sync-core, so equality is structural;
  the test now scans BOTH apps' collection files for a `defineCollection` bypass
  (own `schemaVersion` literal or direct tanstack-builder import).
- **Unit — `upload-manager` state machine** (mobile, fake timers, §3d): `autoStart:
  false` rests until `startUpload`; success removes row + local file; online failure
  walks backoff (1s, 2s…); offline failure → `awaiting_network`, reconnect retries;
  concurrent `doUpload` → single POST (`inFlight`); `cancelUpload` clears file+row;
  `renameUpload` → false mid-upload.
- **Unit — `collections/_shared`**: `coerceBool`; `NEVER_GC` non-finite; 401→2s vs
  other→5s retry delays.

**Minimal, behaviour-preserving prod seams introduced to enable these tests:**
- `@buildinlime/domain-types` gained a **canonical `NON_RETRIABLE_TRPC_CODES`**.
  *(2026-07-16: promoted from "list both clients are tested against" to "list both
  clients derive their Set from" — the parity tests became unnecessary.)*
- Extracted **`infrastructure/database/shape-where.ts`** (pure `parseIdList` /
  `idListWhere`) from the inline route logic; `api/messages.ts` now uses it. The route
  was untestable without dragging in TanStack Start's `createFileRoute`.
- ~~Exported the two `mutation-fns` non-retriable `Set`s~~ *(2026-07-16: moot — the
  outbox spine lives in sync-core and derives the Set itself.)*
- *(2026-07-16)* Extracted **`appRouter` composition** from `routes/api/trpc/$.ts`
  into `infrastructure/trpc/routers/index.ts` (same `createFileRoute` problem as
  shape-where); the route file and `trpc-client.ts` import it from there. Enables
  the contract-router parity spec.

**Diverged from plan / config bugs found while writing specs:**
- Vitest **`fileParallelism: false` must be at the ROOT `test` config, not per
  project** — ignored inside a project, so integration files ran concurrently and
  deadlocked `TRUNCATE … CASCADE` against another file's transaction.
- The integration pool needs **`max: 1`** for the same reason (a router transaction
  and the between-test TRUNCATE on two connections deadlock).
- The shape-guard test targets the extracted `shape-where.ts`, not the route handler
  directly (the 401 path lives in the route and is left to Phase 4's E2E).

### Phase 4 — Playwright E2E (web) — ✅ DONE
`@playwright/test` ^1.61.1, `playwright.config.ts`, `tests/e2e/` (global-setup,
helpers, two specs), and a dedicated `docker-compose.e2e.yaml` (Postgres + Electric)
that CI brings up with `--wait` and tears down with `down -v`. Both specs as planned:
- **offline-sync** — post message → `context.setOffline(true)` → create task + delete
  resource → assert optimistic UI → back online → outbox drains, mutations survive
  reload. This is the one place the txid-handshake window (§12.6) and the write path
  (§5) are exercised end to end.
- **two-user-sync** — two browser contexts; A posts, B receives via Electric.

**Diverged from plan — four deliberate changes:**

- **`webServer` runs `pnpm dev` (vite), not the built app.** The plan said built;
  running dev keeps one server definition instead of a build-then-serve step CI would
  have to sequence. `reuseExistingServer: !process.env.CI`, so local runs attach to a
  dev server you already have up.
- **`DISABLE_CADDY` opt-out added to `vite.config.ts:64`.** The Caddy plugin fronts dev
  with HTTPS at :5173 and **hard-exits if the `caddy` binary is missing** — fatal on a
  CI runner that has no reason to install it. The env toggle is the seam.
- **`globalSetup` bypasses the email-OTP login entirely.** It inserts a real `sessions`
  row and hands the browser a cookie signed with Better Auth's own `makeSignature` from
  `better-auth/crypto` — the same primitive the server verifies with. With only the
  session_token cookie present, `getSession` falls back to a DB lookup by token and
  finds the seeded row. No Resend, no `verifications` table, **no prod-code changes**.
  It reuses the integration harness (migrate/reset/factories) so seeding stays
  single-sourced.
- **`fullyParallel: false`.** The specs share one seeded channel and drive
  optimistic/offline state; racing writes through a single outbox is not a test, it is
  a coin flip.

> **Cookie-name footgun, recorded because it has now bitten twice.** `global-setup.ts`
> uses the **un-prefixed** `better-auth.session_token`, correct here because
> `useSecureCookies` is false in dev. Over HTTPS better-auth adds a `__Secure-` prefix,
> and the un-prefixed name then authenticates as *nobody* — which surfaces as a
> confusing "no user" rather than an auth error. The production verification script hit
> exactly this (`deploymentPlan.md` §10). Same cookie, two names, decided by scheme.

### Phase 5 — CI (GitHub Actions) — ✅ DONE
`.github/workflows/ci.yml`, pnpm 10.30.3 + Node 22, cached store, concurrency-cancel.
Jobs:
- **build** — `pnpm --filter buildinlime build`, green today → hard gate. Dummy
  `DATABASE_URL`/`BETTER_AUTH_SECRET` env (nothing connects at build; `connection.ts`
  and auth throw if unset during prerender).
- **unit** — `pnpm test:unit` (web jsdom + mobile node). No database.
- **integration** — `pnpm test:integration` against a `postgres:17-alpine` **service**;
  the harness creates + migrates `buildinlime_test`.
- **e2e** — Phase 4's stack + specs. Added once Phase 4 landed; a hard gate, and the
  `deploy` job (below) waits on it.
- **quality** — the baseline-count ratchet (below).
- **deploy** — Phase 6. `main` only, `needs` all five gates above.

**Diverged from plan — two deliberate changes:**
- **No `wal_level=logical` on the integration service.** That is only needed for
  Electric replication; the integration tier exercises SQL + `generateTxId`
  (`pg_current_xact_id()`), which work on a default Postgres. Simpler, and GitHub
  service containers can't easily pass `-c wal_level=logical` anyway.
- **The ratchet is baseline-count, NOT changed-files.** The plan's "fail on
  typecheck/lint errors in changed files" was implemented, then replaced after local
  validation exposed a false-positive: whole-file conditions like mobile's
  `AppRouter = any` (§12.4) mean simply *touching* `mutation-fns.ts` (Phase 3 added an
  `export`) would fail a changed-files gate for ~20 errors that were already there.

  Instead, `.github/quality-baseline.json` holds a **max tolerated error count** per
  workspace/check. **Current (2026-07-19): `buildinlime` 0 type / 147 lint;
  `buildinlimemobile` 0 / 0; every `packages/*` entry 0.**

  **Typecheck is now 0 everywhere — a hard gate, no longer a debt number, and it must
  not be raised to accommodate a change.** That is the ratchet having done its job: the
  numbers were 232/201 and 57/5 when this section was first written, 224/188 after the
  2026-07-16 refactor. Web lint is the only debt left.
  `.github/scripts/ratchet.sh` runs the full `typecheck` + `lint`, counts errors, and
  **fails only when a count EXCEEDS its baseline** (a net regression); when a count
  drops it says so and asks you to lower the baseline — the debt ratchets down without
  punishing edits to already-dirty files. Counts land in the job summary as a table.

  *(2026-07-16)* The shared packages (`@buildinlime/contracts`, `sync-core`,
  `domain-types`) each gained a `typecheck` script and a **baseline of 0** — born
  clean, so the same ratchet machinery is a hard gate for them. They have no eslint
  config yet, so no lint entries; add both when one lands.

- **`playwright install chromium` runs WITHOUT `--with-deps`.** `--with-deps` shells out
  to apt-get, which races the runner's own `apt-daily` / `unattended-upgrades` on
  `/var/lib/apt/lists/lock` — a race that cannot be won from inside the job. The
  `ubuntu-24.04` runner image already ships every shared library headless Chromium
  needs, so the OS-deps step buys nothing. See the comment at `ci.yml:122-125`; four
  commits went into discovering this, so do not "helpfully" add the flag back.

> Watch-out for whoever runs this: the ratchet baselines are a committed snapshot.
> When you fix errors and a count drops, **lower the matching number** in
> `quality-baseline.json` in the same PR, or the gain isn't locked in.

### Phase 6 — CD — ✅ BUILT (web). Mobile still open.

**The two blockers were resolved, not waived.** This section previously said CD was
blocked on `ARCHITECTURE.md` §12.1 (file storage on the local filesystem) and §12.3
(`ELECTRIC_INSECURE: true`). Both are closed: the object-storage migration put every
byte behind a `StorageProvider` with a GCS driver, and the production Compose file
deliberately omits `ELECTRIC_INSECURE`, passing a real `ELECTRIC_SECRET` instead.

**The target is a single GCE VM, not SST→AWS.** This doc's guess — `sst` sitting in
devDependencies with no config committed — did not survive contact with the Electric
hosting decision. Self-managed Electric holds a logical replication slot and needs a
persistent filesystem, so it cannot run serverless; co-locating it with the app on one
VM beat straddling two platforms. The full reasoning, including why Electric Cloud and
a Cloud Run sidecar were both rejected, is in `deploymentPlan.md` §1 and §4.5.

**What exists** (`deploymentPlan.md` §9 owns the detail — do not duplicate it here):

| File | Role |
|---|---|
| `ci.yml` `deploy` job | `main` only, `needs` all five gates, `concurrency: deploy-production` with `cancel-in-progress: false` |
| `deploy/setup-cicd.sh` | one-time WIF bootstrap — no downloaded service-account key, ever |
| `deploy/deploy.sh` | pull → migrate → Electric ownership sweep → `up -d` → smoke, with image-only rollback |
| `deploy/verify-storage.sh` | post-deploy verification of the storage path and the access gate |

The ordering lives in `deploy.sh` rather than in YAML so it is versioned, reviewable,
and runnable by hand during an incident.

**Status: written, not yet executed.** The WIF resources `setup-cicd.sh` creates do not
exist, and the deploy work sits on `chore/gcp-vm-deployment` — so the job's `main`-only
gate has never fired. Production was deployed by hand. Expect the first CI-driven
deploy to be the first real test of this path.

**Mobile CD remains open** — EAS Build + EAS Update, unchanged and unstarted.

---

## 6. Explicitly out of scope (for now)
- RN component rendering (needs `jest-expo` + a second runner).
- The existing type/lint errors — the ratchet holds the line and shrinks them over
  time, not a big-bang fix.
- The presentation layer beyond E2E paths — snapshot-testing UI now buys mostly churn.
- The **mark-seen / blur trigger** divergence (§10) and idle-GC resurrection (§6) —
  genuine platform traps, but they need rendered-component or on-device harnesses;
  the E2E two-user spec covers the user-visible outcome (badges converge) without
  reaching for them.

## 7. Dependencies
Added so far:
- Mobile: `vitest`, `@vitest/coverage-v8` (web already had `vitest` + Testing Library
  + jsdom).

Still to add for Phase 4:
- Web: `@playwright/test`.
