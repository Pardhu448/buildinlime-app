# Android Play Store Release Plan — BuildInLime Mobile

Roadmap for shipping the Expo / React Native app in `mobile-app/` to the Google
Play Store. **Web app and server productionizing are assumed handled elsewhere**
(see `web-app/code/agentGuides/deploymentPlan.md`); this doc covers only the
mobile client and the Play release path.

Drafted 2026-07-19 against `chore/mobile-eas-android-release` (branched off `main`).

## Current state (what the repo already has)

- **Stack:** Expo SDK 55, React Native 0.83, React 19, expo-router (typed routes),
  NativeWind. Auth via `better-auth`; data sync via ElectricSQL + TanStack DB;
  API via tRPC.
- **Monorepo:** pnpm workspaces. The app consumes workspace packages
  `@buildinlime/contracts`, `@buildinlime/domain-types`, `@buildinlime/sync-core`.
  `node-linker=hoisted` in `.npmrc` (root + `mobile-app`).
- **Native config** (`app.json`): portrait, adaptive icon + splash assets present,
  permissions declared for `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`,
  `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`. Scheme
  `buildinlimemobile`. Custom config plugin `./plugins/withOkHttpDispatcher`.
- **No `eas.json`** and no `eas-cli` installed — EAS Build is not yet set up.
- **CI:** `.github/workflows/ci.yml` exists (lint/typecheck/test); no build/release job.

## Blockers to fix before the first upload (repo-specific)

1. **Application ID is the Expo placeholder.** `app.json` → `android.package` is
   `com.anonymous.BuildInLimeMobile`. Google Play **permanently binds** the app to
   this ID on first upload — it can never be changed afterward. **DECISION PENDING**
   (see Open Decisions). Also revisit `expo.name` (currently `BuildInLimeMobile`),
   which becomes the on-device label / listing title.
2. **API URL points at localhost.** `.env.example` ships
   `EXPO_PUBLIC_API_URL=http://localhost:3000`. `EXPO_PUBLIC_*` is inlined into the
   bundle at build time, so a production build **must** bake in the real HTTPS API
   URL — wired via an EAS build-profile `env` (Phase 2).
3. **Stale root `android/` project.** A broken `android/` at the repo root can
   shadow `mobile-app/android/` (known project gotcha). EAS builds from `mobile-app/`;
   confirm builds resolve the correct native project.
4. **Sensitive-permission justification.** `RECORD_AUDIO` + foreground-service media
   playback require a Data Safety declaration and often a written justification in
   the Play listing. Draft the copy before submission.
5. **No crash reporting.** No Sentry / expo-insights wired. Not a hard blocker, but
   strongly recommended before a production rollout.

## Phase 1 — App identity & production config

- Set final `android.package` / iOS bundle ID and `expo.name` (see Open Decisions).
- Establish `version` + Android `versionCode` strategy (EAS can auto-increment
  `versionCode` per build via `autoIncrement`).
- Verify adaptive icon (`android-icon-*`) and splash assets are final, not placeholders.
- Confirm production OAuth / deep-link redirects for `better-auth` match the
  `buildinlimemobile` scheme.

## Phase 2 — EAS Build setup  ← START HERE

1. `npm i -g eas-cli`, then `eas login` and `eas init` (creates the Expo project,
   writes `extra.eas.projectId` into `app.json`, scaffolds `eas.json`). `eas login`
   / `eas init` are **interactive** — run them yourself (e.g. `! eas login`).
2. Define build profiles in `eas.json`:
   - `development` — dev client.
   - `preview` — internal `.apk`, `distribution: internal`.
   - `production` — `.aab` for Play, with
     `env.EXPO_PUBLIC_API_URL = <prod https url>`.
3. **pnpm-monorepo gotcha:** EAS must resolve the `@buildinlime/*` workspace
   packages. This is the most likely failure for this repo. Guardrails: commit
   `pnpm-lock.yaml`, keep `node-linker=hoisted`, ensure the workspace root is
   detected. **Do a `preview` build first** to shake this out before touching
   production.

## Phase 3 — Signing

- Let **EAS manage the Android keystore** (recommended); it generates and stores it.
  **Back it up** (`eas credentials`) — losing the keystore means you can never
  update the app.
- Enroll in **Play App Signing** (default for new apps) at listing creation.

## Phase 4 — Google Play Console setup (one-time)

- Create a Play Console account ($25 one-time fee).
- **New personal developer accounts must run ~14 days of closed testing with 12+
  testers before production access unlocks.** This is the schedule long pole — start
  it early, in parallel with Phase 2.
- Complete: store listing (title, short + full description, phone screenshots,
  feature graphic 1024×500, icon 512×512), content-rating questionnaire, **Data
  Safety form** (auth, audio, uploads), target audience, and a **privacy policy URL**
  (required).

## Phase 5 — Test tracks → Production

1. `eas build --platform android --profile production` → `.aab`.
2. `eas submit --platform android` → **Internal testing** track first.
3. Promote to **Closed testing** to satisfy the 12-tester / 14-day gate.
4. Promote to **Production** with a staged rollout (e.g. 20% → 100%).

## Phase 6 — Post-release

- Wire crash reporting (Sentry / `expo-insights`).
- Decide on **EAS Update (OTA)** for JS-only fixes without store review.
- Add an EAS build/submit job to `.github/workflows/ci.yml`, triggered on release tags.

## Timeline

The **14-day closed-testing gate** dominates; everything else is a few days of work.
Kick off the Play account + closed test **early, parallel with Phase 2 build setup**.

## Open decisions (blocking Phase 1/2 file edits)

| Decision | Current | Proposed | Status |
|---|---|---|---|
| Android application ID (permanent) | `com.anonymous.BuildInLimeMobile` | `com.buildinlime.mobile` | **PENDING** |
| Display name / listing title | `BuildInLimeMobile` | `BuildInLime` | **PENDING** |

Once these are settled, the next edits are: update `app.json` identity fields and
author `eas.json` with the three build profiles.
