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
3. ~~**`android.versionCode` is unset.**~~ **SETTLED 2026-07-22.** `eas.json` sets
   `cli.appVersionSource: "remote"` and `autoIncrement: true` on the `production`
   profile, so **EAS owns the version counter on its servers**. `android.versionCode`
   is deliberately absent from `app.json` — under `remote` it would be ignored, and
   having a stale number sitting there invites someone to "fix" it by hand. Do not
   add a competing CI increment; two owners produce duplicate-version rejections.
4. **Sensitive-permission justification.** `RECORD_AUDIO` requires a Data Safety
   declaration and often a written justification in the Play listing. **Draft copy is
   in `PLAY_DATA_SAFETY.md`** (2026-07-23) — still needs a live privacy-policy URL and
   server-side deletion/retention answers confirmed. The
   `FOREGROUND_SERVICE_MEDIA_PLAYBACK` re-audit is **done (2026-07-23): dropped.**
   Playback is foreground-only, so expo-audio's `enableBackgroundPlayback` is now
   `false`; the FGS permissions + `AudioControlsService` are gone (clean-prebuild
   verified), so no Play foreground-service declaration is needed.
5. **No crash reporting.** Crash reporting was briefly wired with
   `@sentry/react-native` (2026-07-23) and then **removed (2026-07-25)** — the SDK,
   its `app.json` config plugin, the `initSentry()`/`Sentry.wrap` in `app/_layout.tsx`,
   the `SENTRY_DISABLE_AUTO_UPLOAD` build flags, and the observability module are all
   gone. The shipping app therefore contains **no crash-reporting, analytics, or
   tracking SDK** (this keeps the Data Safety declaration to user content + account
   data only — see `PLAY_DATA_SAFETY.md`). If crash reporting is wanted later,
   re-add an SDK *and* update `PLAY_DATA_SAFETY.md` + the Data Safety form in the
   same change (Sentry needs a runtime DSN and, for readable stack traces, build-time
   source-map upload via `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`).

## Phase 1 — App identity & production config

- Set final `android.package` / iOS `bundleIdentifier` and `expo.name` / `slug`
  (see Open Decisions). Set the iOS bundle ID now even though iOS is not shipping —
  cheaper than a second identity migration later.
- Establish `version` + Android `versionCode` strategy (Blocker 3).
- Verify adaptive icon (`android-icon-*`) and splash assets are final, not Expo
  scaffold placeholders.
- Confirm production OAuth / deep-link redirects for `better-auth` match the
  `buildinlimemobile` scheme.

## Phase 2 — EAS Build setup

1. ~~`eas login` + `eas init`.~~ **DONE 2026-07-23.** Expo project created under
   owner `buildinlime`; `extra.eas.projectId` (`8413a5c9-…`) and `owner` written to
   `app.json`. `eas init` also bound `slug` to `buildinlime` (was `BuildInLimeMobile`)
   — now permanent. The `scheme` (`buildinlimemobile`) was left untouched, so the
   `better-auth` deep-link redirects are unaffected.
2. Define build profiles in `eas.json`:
   - `development` — dev client (`expo-dev-client` is not currently a dependency).
   - `preview` — internal `.apk`, `distribution: internal`,
     `env.EXPO_PUBLIC_API_URL = https://app.buildinlime.com`.
   - `production` — `.aab` for Play, `autoIncrement`, same `env`.
3. **Verify the URL actually inlined** by inspecting the built bundle, not by
   launching the app. All 7 fallbacks silently resolve to the emulator alias
   `10.0.2.2:3000` if the inline fails — which builds, installs and opens fine, and
   then cannot reach anything. Use **`scripts/verify-api-url.sh <artifact.apk>`**
   (added 2026-07-23): it greps the Hermes bundle for the prod URL and exits non-zero
   if only the fallback is present.
4. **Do a `preview` build first**, before touching production, purely to shake out
   Risks 1 and 2 below. **DONE 2026-07-25** — build `1511c8f4-…` succeeded (APK,
   `distribution: internal`). Verified on the real artifact:
   - `verify-api-url.sh` **PASS** — `https://app.buildinlime.com` inlined in the
     Hermes bundle, emulator fallback absent (Blocker 2 closed on a real build).
   - `withOkHttpDispatcher` **survived prebuild** (Risk 1) — the injected class
     `com/buildinlime/mobile/BuildInLimeOkHttpClientFactory` and `setOkHttpClientFactory`
     are compiled into the DEX.
   - pnpm workspace resolution on EAS (Risk 2) held — the build would not have
     succeeded otherwise.
   - Sentry absent (`io/sentry` = 0 classes), matching the Data Safety declaration.

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

- **DONE 2026-07-25.** EAS generated and stored the Android keystore on the first
  `preview` build (`Build Credentials TPPEnuUdKg`), and it has been **backed up**
  (`eas credentials` → download). Under Play App Signing (below), this keystore is
  the *upload key*; losing it is recoverable via Google, but it is backed up anyway.
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

- **Crash reporting — deferred (Sentry removed 2026-07-25).** The app ships with
  no crash/analytics SDK. If it is wanted post-release, re-add an SDK and, in the
  *same* change, update `PLAY_DATA_SAFETY.md` + the Play Data Safety form to declare
  Crash logs / Diagnostics / Device IDs. For Sentry specifically that means: the
  runtime DSN, plus build-time **source-map upload** for de-minified stack traces
  (`SENTRY_AUTH_TOKEN` as an EAS secret, `SENTRY_ORG` + `SENTRY_PROJECT` via env or
  the config-plugin options; never commit the token).
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
| `versionCode` owner | EAS `autoIncrement`, `appVersionSource: remote` | **SETTLED** 2026-07-22 |
| `slug` | `buildinlime` (bound by `eas init`) | **SETTLED** 2026-07-23 |
| iOS `bundleIdentifier` | `com.buildinlime.mobile` | **SETTLED** 2026-07-22 |

Two identity fields around `eas init`:

- **`slug` is now `buildinlime`.** `eas init` bound it to the Expo project (was
  `BuildInLimeMobile`). It is the EAS/Expo project identifier, appears in `expo.dev`
  URLs, and is not user-facing — but it is now fixed to the project and should not be
  hand-edited.
- **`scheme` is still `buildinlimemobile`.** Do **not** change this casually: it
  is the deep-link scheme `better-auth` redirects through, so it must stay in
  sync with the production OAuth redirect configuration.
iOS `bundleIdentifier` is set to `com.buildinlime.mobile` — the same string as
the Android application ID. The two namespaces are independent, so matching them
is a convention, not a requirement; it is done here so one identity covers both
stores. Apple binds a bundle ID to an App Store record on first submission, the
same way Play binds the application ID.

Next (as of 2026-07-25): the engineering path is green — Phases 1–3 are done and
verified on a real APK (see Phase 2 step 4). The remaining critical path is
**Play Console (Phase 4)**, which is done in the Console web UI and is the schedule
long pole (account verification + the ~14-day / 12-tester closed-testing gate). The
inputs to paste into the Console — Data Safety answers, store listing copy, and the
permission justification — are prepared in `PLAY_CONSOLE_INPUTS.md`. When ready for
Phase 5, merge this branch to `main` and build `production` (`.aab`) from `main`.

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
