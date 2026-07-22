# Android Play Store Release Plan — BuildInLime Mobile

Roadmap for shipping the Expo / React Native app in `mobile-app/` to the Google
Play Store. **Web app and server productionizing are assumed handled elsewhere**
(see `agentGuides/deploymentPlan.md`); this doc covers only the
mobile client and the Play release path.

Drafted 2026-07-19 against `chore/mobile-eas-android-release` (branched off `main`).
Revised 2026-07-22 after rebasing onto `main` and re-verifying every claim against
the tree — three items in the original draft were stale; see Revision notes at the end.

## Current state (what the repo already has)

- **Stack:** Expo SDK 55, React Native 0.83, React 19, expo-router (typed routes),
  NativeWind 4. Auth via `better-auth`; data sync via ElectricSQL + TanStack DB;
  API via tRPC.
- **Monorepo:** pnpm workspaces (`packages/*`, `web-app/code`, `mobile-app`). The app
  consumes workspace packages `@buildinlime/contracts`, `@buildinlime/domain-types`,
  `@buildinlime/sync-core` as `workspace:*`. `node-linker=hoisted` in `.npmrc`
  (root + `mobile-app`), `pnpm-lock.yaml` committed, `packageManager: pnpm@10.30.3`.
- **Native config** (`app.json`): portrait, adaptive icon + splash assets present,
  permissions declared for `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`,
  `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`. Scheme
  `buildinlimemobile`. Custom config plugin `./plugins/withOkHttpDispatcher`.
- **Managed / CNG project:** `mobile-app/android/` is **gitignored** (`.gitignore:78`)
  and untracked. EAS therefore runs `expo prebuild` on its builders and regenerates
  all native code from `app.json` + config plugins. This shapes the top risk below.
- **No `eas.json`** and no `eas-cli` installed — EAS Build is not yet set up. Also
  absent: `expo-dev-client`, `expo-updates`, any crash reporting.
- **API base URL** is read from `process.env.EXPO_PUBLIC_API_URL` in **7 modules**
  (tRPC client, auth client, cookie-fetch, collections, upload-manager, resource
  download, media-source), each falling back to `http://10.0.2.2:3000`.
- **CI:** `.github/workflows/ci.yml` exists (build / unit / integration); no
  build/release job for mobile.

## Blockers to fix before the first upload (repo-specific)

1. ~~**Application ID is the Expo placeholder.**~~ **SETTLED 2026-07-22.**
   `android.package` is now `com.buildinlime.mobile` and `expo.name` is
   `BuildInLime`. Google Play **permanently binds** the application ID on first
   upload — it can never be changed afterward, so this must not be edited again
   once anything is submitted. `slug` deliberately stays `BuildInLimeMobile`
   (see Open Decisions).
2. **Production API URL must be baked in.** The prod API is live at
   **`https://app.buildinlime.com`** (deployed 2026-07-20, per
   `agentGuides/deploymentPlan.md`). `EXPO_PUBLIC_*` is inlined into the
   bundle at build time, and `.env` is gitignored (`.gitignore:18`, `*.env` at `:27`),
   so there is no committed file EAS could read this from — it **must** come from an
   EAS build-profile `env` block (Phase 2).
3. **`android.versionCode` is unset.** Nothing in `app.json` defines it. Pick exactly
   one owner — EAS `autoIncrement` or CI — and stick to it; mixing the two produces
   duplicate-version upload rejections.
4. **Sensitive-permission justification.** `RECORD_AUDIO` + foreground-service media
   playback require a Data Safety declaration and often a written justification in
   the Play listing. Draft the copy before submission. `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
   is worth re-auditing — if playback is foreground-only, dropping it removes a Play
   review surface for free.
5. **No crash reporting.** No Sentry / expo-insights wired. Not a hard blocker, but
   strongly recommended before a production rollout.

## Phase 1 — App identity & production config

- Set final `android.package` / iOS `bundleIdentifier` and `expo.name` / `slug`
  (see Open Decisions). Set the iOS bundle ID now even though iOS is not shipping —
  cheaper than a second identity migration later.
- Establish `version` + Android `versionCode` strategy (Blocker 3).
- Verify adaptive icon (`android-icon-*`) and splash assets are final, not Expo
  scaffold placeholders.
- Confirm production OAuth / deep-link redirects for `better-auth` match the
  `buildinlimemobile` scheme.

## Phase 2 — EAS Build setup  ← START HERE

1. `npm i -g eas-cli`, then `eas login` and `eas init` (creates the Expo project,
   writes `extra.eas.projectId` into `app.json`, scaffolds `eas.json`). `eas login`
   / `eas init` are **interactive** — run them yourself (e.g. `! eas login`).
2. Define build profiles in `eas.json`:
   - `development` — dev client (`expo-dev-client` is not currently a dependency).
   - `preview` — internal `.apk`, `distribution: internal`,
     `env.EXPO_PUBLIC_API_URL = https://app.buildinlime.com`.
   - `production` — `.aab` for Play, `autoIncrement`, same `env`.
3. **Verify the URL actually inlined** by inspecting the built bundle, not by
   launching the app. All 7 fallbacks silently resolve to the emulator alias
   `10.0.2.2:3000` if the inline fails — which builds, installs and opens fine, and
   then cannot reach anything.
4. **Do a `preview` build first**, before touching production, purely to shake out
   Risks 1 and 2 below.

## Risks, ranked by what actually bites

1. **The `withOkHttpDispatcher` plugin must survive EAS prebuild.** Because
   `android/` is gitignored, EAS regenerates native code from scratch and this plugin
   is the only thing injecting the OkHttp dispatcher caps into `MainApplication.kt`.
   Its own header comment documents the failure mode: *"it fails silently when it
   goes — the JS keeps working and sync just quietly gets slow again."* A production
   build could ship with ~20s message latency and pass every functional test.
   **Verify explicitly** — decompile the preview APK or log the dispatcher caps at
   runtime. Do not infer it from the app working.
2. **pnpm workspace resolution on EAS.** The `@buildinlime/*` packages must resolve
   on EAS's builders; this is the classic monorepo EAS failure. Guardrails are already
   in place (hoisted linker, committed lockfile, workspace root detectable) — the
   `preview` build is what proves it.
3. **Auth origin.** Server `trustedOrigins`
   (`web-app/code/src/infrastructure/auth/server.ts:131`) includes `BETTER_AUTH_URL`
   plus a `MOBILE_ORIGIN` env passthrough. Since the prod `apiUrl` equals the auth
   URL, this *should* work unchanged — confirm against the deployed service rather
   than assuming.

## Phase 3 — Signing

- Let **EAS manage the Android keystore** (recommended); it generates and stores it.
  **Back it up immediately** (`eas credentials`) — losing the keystore means you can
  never update the app.
- Enroll in **Play App Signing** (default for new apps) at listing creation.

## Phase 4 — Google Play Console setup (one-time)

- Create a Play Console account ($25 one-time fee); identity verification takes days.
- **New personal developer accounts must run ~14 days of closed testing with 12+
  testers before production access unlocks.** This is the schedule long pole — start
  it early, in parallel with Phase 2. (Tester-count sources disagree: this doc said
  12+, `Android_App_Publishing_Plan.docx` says 12–20. **Confirm the current number in
  Play Console before recruiting.** That doc also notes organization accounts are
  exempt from the gate but need a D-U-N-S number, which can take up to 30 days.)
- Complete: store listing (title, short + full description, phone screenshots,
  feature graphic 1024×500, icon 512×512), content-rating questionnaire, **Data
  Safety form** (auth, audio, uploads), target audience, and a **privacy policy URL**
  (required).

## Phase 5 — Test tracks → Production

1. `eas build --platform android --profile production` → `.aab`.
2. `eas submit --platform android` → **Internal testing** track first.
3. Promote to **Closed testing** to satisfy the tester / 14-day gate.
4. Promote to **Production** with a staged rollout (e.g. 20% → 100%).

## Phase 6 — Post-release

- Wire crash reporting (Sentry / `expo-insights`).
- Decide on **EAS Update (OTA)** for JS-only fixes without store review
  (`expo-updates` is not currently a dependency).
- Add an EAS build/submit job to `.github/workflows/ci.yml`, triggered on release tags.

## Timeline

The **closed-testing gate dominates**; everything else is a few days of work. Kick off
the Play account registration and tester recruitment **early, parallel with Phase 2
build setup** — not after it.

## Open decisions (blocking Phase 1/2 file edits)

| Decision | Value | Status |
|---|---|---|
| Android application ID (permanent) | `com.buildinlime.mobile` | **SETTLED** 2026-07-22 |
| Display name / listing title | `BuildInLime` | **SETTLED** 2026-07-22 |
| `versionCode` owner | EAS `autoIncrement` proposed | **PENDING** |
| `slug` | `BuildInLimeMobile` (unchanged) | **PENDING** — see below |
| iOS `bundleIdentifier` | unset | **PENDING** — see below |

Two identity fields were **left alone deliberately** and are worth a decision
before `eas init` runs:

- **`slug` is still `BuildInLimeMobile`.** It is the EAS/Expo project identifier
  and appears in `expo.dev` URLs, not in anything user-facing. It is free to
  change *now*, but `eas init` binds it to the Expo project, so changing it after
  that is disruptive. Purely cosmetic — the argument for changing it is
  consistency, not correctness.
- **`scheme` is still `buildinlimemobile`.** Do **not** change this casually: it
  is the deep-link scheme `better-auth` redirects through, so it must stay in
  sync with the production OAuth redirect configuration.
- **iOS `bundleIdentifier` is unset.** iOS is not shipping, but setting it now is
  cheaper than a second identity migration later.

Next edits: author `eas.json` with the three build profiles (Phase 2).

## Revision notes (2026-07-22)

Corrections from re-verifying the 2026-07-19 draft against the tree:

- **Removed the "stale root `android/`" blocker.** There is no `android/` directory at
  the repo root, so nothing can shadow `mobile-app/android/`. The original blocker was
  wrong.
- **Production API URL resolved** to `https://app.buildinlime.com`; the draft only knew
  that `.env.example` pointed at localhost.
- **Added the CNG / prebuild finding** — `mobile-app/android/` being gitignored was not
  called out in the draft, and it is what makes the `withOkHttpDispatcher` plugin the
  single highest-risk item in the release.
