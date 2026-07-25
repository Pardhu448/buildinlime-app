# Play Store Data Safety & Permission Justifications — BuildInLime Mobile

Pre-submission copy for the Google Play **Data Safety** form and the permission
justifications the review process asks for. Companion to `ANDROID_RELEASE_PLAN.md`
(Blocker 4). Drafted 2026-07-23 from the app source; the client-side facts below
are read straight off the code, the **server-side facts are marked to confirm**.

> Both pre-submission conditions are now RESOLVED (2026-07-25):
> 1. **Privacy policy URL is live:** `https://app.buildinlime.com/privacy` (DPDP v1.0,
>    deployed from PR #72). It describes exactly the collection below.
> 2. **Retention / deletion answered:** account + data deletion is requestable in-app
>    (Account → Delete account & data → emails a request to support@buildinlime.com,
>    actioned manually); data is deleted within **30 days** of the request, and
>    backups are overwritten within 30 days (privacy policy clauses 10–11).

---

## What the app actually collects (from the code)

| Data | Where in the app | Sent to the server? |
|---|---|---|
| **Email address** | `app/(auth)/login.tsx` — email + 6-digit OTP sign-in (`better-auth` email OTP, **no passwords**). `trpc.users.checkEmail` + `emailOtp.sendVerificationOtp`. | Yes — it *is* the account identifier. |
| **Name / profile** | Account record on the server (better-auth). Not entered in the mobile client. | Yes (server-side). Confirm what profile fields exist. |
| **Photos & videos** | `src/presentation/messages/lib/capture.ts` via `expo-image-picker` (library + camera). | Yes — uploaded to `POST /api/resources/upload`. |
| **Documents / files** | Same, via `expo-document-picker`. | Yes — same upload endpoint. |
| **Voice recordings (audio)** | `AudioRecorderModal.tsx` via `expo-audio` (`RECORD_AUDIO`). | Yes — uploaded as a resource. |
| **Messages (text)** | Channel/message composer; synced via ElectricSQL + tRPC. | Yes. |
| **Session cookie** | `expo-secure-store` (`src/infrastructure/auth/cookie-fetch.ts`). | Stored on-device; sent as an auth header. |
| **Local cache DB** | `expo-sqlite` — synced rows cached for offline; wiped on sign-out (`signOutAndDispose`). | On-device only. |

**No ad, tracking, analytics, crash-reporting, or location SDK is present.** There
is no Sentry, Firebase, GMS, or comparable SDK in the app — crash reporting was
removed, so the shipping build collects and sends nothing beyond the user content
and account data listed above (all to our own backend).

> If crash reporting or any analytics SDK is ever re-introduced, it will typically
> collect **crash logs / diagnostics** and often a device/installation identifier —
> which adds "Crash logs", "Diagnostics", and "Device or other IDs" rows to the form
> below. Update this doc and the Data Safety form in the *same* change that adds it.

---

## Data Safety form — section by section

Google's form asks, per data type: **Collected?** / **Shared?** / **Processed
ephemerally?** / **Required or optional?** / **Purposes**.

### Personal info → Email address
- Collected: **Yes.** Shared: **No** — the OTP email provider (Resend) is a
  processor/sub-processor, not a data "share" (privacy clauses 6–7).
- Required: **Yes** (cannot use the app without an account).
- Purposes: **App functionality**, **Account management**.

### Personal info → Name
- Collected: **Yes (server-side account).** Shared: **No.**
- Required/optional: **Required** — a name is captured at account creation (the
  signup form requires it).
- Purposes: **App functionality**, **Account management**.

### Photos and videos
- Collected: **Yes** (user attaches them to messages/tasks). Shared: **No.**
- Required: **Optional** (only when the user chooses to attach).
- Purposes: **App functionality** (user-generated content in a project channel).

### Files and docs
- Collected: **Yes.** Shared: **No.** Optional. Purpose: **App functionality.**

### Audio → Voice or sound recordings
- Collected: **Yes** (voice messages). Shared: **No.** Optional (user initiates a
  recording). Purpose: **App functionality.**

### Messages → Other in-app messages
- Collected: **Yes.** Shared: **No.** Required to the feature. Purpose:
  **App functionality.**

### App activity / Device IDs / Location
- **None declared.** No crash-reporting or analytics SDK is present. (Revisit
  "Device or other IDs" + "Crash logs" only if one is ever added — see the note above.)

### Security practices (the two form toggles)
- **Encrypted in transit:** **Yes.** Production API is `https://app.buildinlime.com`
  (TLS); the emulator-only `http://10.0.2.2` path never ships (guarded by
  `scripts/verify-api-url.sh`).
- **Users can request deletion:** **Yes.** In-app: Account → "Delete account & data"
  (`/delete-account`) files a request to support@buildinlime.com; data is removed
  within 30 days. Documented in the privacy policy (clauses 10–11) and the deletion
  URL is the Account page. In the Data Safety form set "users can request data
  deletion" = Yes and give the account-page/URL path.

---

## Permission justifications (for the listing / review replies)

Play flags `RECORD_AUDIO` and the foreground-service permissions and often asks for a
one-line justification. Declared in `app.json` → `android.permissions`:

- **`RECORD_AUDIO`** — "Used only when the user taps the microphone button to record a
  voice message inside a project channel. Recording is user-initiated and never runs in
  the background."
- **`MODIFY_AUDIO_SETTINGS`** — "Adjusts the audio route/volume while recording or
  playing back a voice message."
- **`FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_MEDIA_PLAYBACK`** — **REMOVED 2026-07-23,
  so no justification / Play declaration is needed.** These were never a deliberate
  choice: expo-audio's plugin defaults `enableBackgroundPlayback: true`, which added
  both permissions *and* shipped an `AudioControlsService` (foreground-service type
  `mediaPlayback`). The app only plays media in the foreground (short voice messages,
  in-modal video), so `enableBackgroundPlayback` is now `false` and the two permissions
  were dropped from `android.permissions`. A clean prebuild confirms the manifest no
  longer declares the service or the permissions. Recording (`RECORD_AUDIO`) and
  foreground playback are unaffected. **If background audio (lock-screen controls) is
  ever wanted, re-enabling it means completing Play's Foreground Service declaration.**
- **Photo library / camera** — handled by `expo-image-picker`'s runtime prompts; the
  user-facing strings are in `app.json` (`photosPermission`, `cameraPermission`).

---

## Before-you-submit checklist

- [x] Privacy policy URL live, reachable, and covers every row above — `https://app.buildinlime.com/privacy` (DPDP v1.0).
- [x] Server-side: retention window + deletion mechanism confirmed and documented — 30-day deletion, in-app request flow (privacy clauses 10–11).
- [x] No crash-reporting/analytics SDK present (Sentry removed). If one is added, add Crash logs / Diagnostics / Device-ID rows.
- [x] `FOREGROUND_SERVICE_MEDIA_PLAYBACK` re-audited → **dropped** (foreground-only playback).
- [x] "Encrypted in transit = Yes" backed by `verify-api-url.sh` — PASS on the `preview` APK (build `1511c8f4-…`, 2026-07-25). Re-run on the production `.aab` before submit.
- [x] OTP email provider (Resend) treated as a **processor/sub-processor**, not a data "share" — declared in the privacy policy (clauses 6–7).
