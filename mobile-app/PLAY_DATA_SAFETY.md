# Play Store Data Safety & Permission Justifications — BuildInLime Mobile

Pre-submission copy for the Google Play **Data Safety** form and the permission
justifications the review process asks for. Companion to `ANDROID_RELEASE_PLAN.md`
(Blocker 4). Drafted 2026-07-23 from the app source; the client-side facts below
are read straight off the code, the **server-side facts are marked to confirm**.

> Two things must be true before this is submittable:
> 1. A **privacy policy URL** is live and reachable (Play requires it, and it must
>    describe exactly the collection below). Not yet located in the repo — confirm.
> 2. The **server-side retention / deletion** answers are verified with whoever
>    owns the deployed API. This doc cannot read those from the mobile tree.

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

**No analytics, ad, tracking, or location SDK is present today.** A repo grep for
`sentry|analytics|expo-insights|location` returns nothing in `app/` and `src/`.

> ⚠️ **If crash reporting (Sentry) is wired** — which is in progress on this branch —
> Sentry collects **crash logs / diagnostics** and typically a device/installation
> identifier. That adds a "Crash logs" + "Diagnostics" row (and a "Device or other
> IDs" row) to the form below. Update this doc and the Data Safety form when the DSN
> goes live; do not leave it undeclared.

---

## Data Safety form — section by section

Google's form asks, per data type: **Collected?** / **Shared?** / **Processed
ephemerally?** / **Required or optional?** / **Purposes**.

### Personal info → Email address
- Collected: **Yes.** Shared: **No** (confirm no third-party auth/email vendor
  re-shares it; OTP email delivery provider is a processor, not "sharing").
- Required: **Yes** (cannot use the app without an account).
- Purposes: **App functionality**, **Account management**.

### Personal info → Name
- Collected: **Yes (server-side account).** Shared: **No.**
- Required/optional: **confirm** whether name is mandatory at account creation.
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
- **None declared today.** (Revisit "Device or other IDs" + "Crash logs" the moment
  Sentry is enabled — see the warning above.)

### Security practices (the two form toggles)
- **Encrypted in transit:** **Yes.** Production API is `https://app.buildinlime.com`
  (TLS); the emulator-only `http://10.0.2.2` path never ships (guarded by
  `scripts/verify-api-url.sh`).
- **Users can request deletion:** **CONFIRM.** This depends on the server offering an
  account-deletion path. If none exists, Play still wants a stated deletion mechanism
  (e.g. an email request route) documented in the privacy policy.

---

## Permission justifications (for the listing / review replies)

Play flags `RECORD_AUDIO` and the foreground-service permissions and often asks for a
one-line justification. Declared in `app.json` → `android.permissions`:

- **`RECORD_AUDIO`** — "Used only when the user taps the microphone button to record a
  voice message inside a project channel. Recording is user-initiated and never runs in
  the background."
- **`MODIFY_AUDIO_SETTINGS`** — "Adjusts the audio route/volume while recording or
  playing back a voice message."
- **`FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_MEDIA_PLAYBACK`** — "Keeps audio/video
  playback alive while the user navigates the app." **← Re-audit before submission**
  (`ANDROID_RELEASE_PLAN.md` Blocker 4): if playback is only ever foreground, dropping
  `FOREGROUND_SERVICE_MEDIA_PLAYBACK` removes a Play review surface for free. This doc
  does not assert it is needed — it is declared in `app.json` and must be justified or
  removed, not left ambiguous.
- **Photo library / camera** — handled by `expo-image-picker`'s runtime prompts; the
  user-facing strings are in `app.json` (`photosPermission`, `cameraPermission`).

---

## Before-you-submit checklist

- [ ] Privacy policy URL live, reachable, and covers every row above.
- [ ] Server-side: retention window + deletion mechanism confirmed and documented.
- [ ] Sentry decision made; if enabled, Crash logs / Diagnostics / Device-ID rows added.
- [ ] `FOREGROUND_SERVICE_MEDIA_PLAYBACK` re-audited (keep + justify, or drop).
- [ ] "Encrypted in transit = Yes" backed by `verify-api-url.sh` passing on the shipped `.aab`.
- [ ] Confirm the OTP email provider is treated as a processor, not a data "share".
