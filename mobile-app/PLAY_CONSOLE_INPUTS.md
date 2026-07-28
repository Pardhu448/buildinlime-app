# Play Console Inputs — BuildInLime Mobile

Everything to paste into the Google Play Console for the first submission. Companion
to `ANDROID_RELEASE_PLAN.md` (Phase 4) and `PLAY_DATA_SAFETY.md` (the Data Safety
form detail). Prepared 2026-07-25. Character limits are Play's current maximums.

The **graphics assets** (icon, feature graphic, screenshots) are the one thing this
doc cannot supply — see the checklist at the end. They are needed for the **production**
release only; closed testing does not require them.

---

## App identity (already fixed — do not change)

| Field | Value |
|---|---|
| Application ID (package) | `com.buildinlime.mobile` |
| App name (store title, ≤30 chars) | `BuildInLime` |
| Version name / code | Owned by EAS (`appVersionSource: remote`, `autoIncrement`) |
| Default language | English (India) — `en-IN` |
| App or game | App |
| Free or paid | Free |
| Contains ads | No |

---

## Store listing

**App name** (≤30): `BuildInLime`

**Short description** (≤80, this is 78):
```
Construction project management. Channels, tasks, files, voice. Offline-first.
```

**Full description** (≤4000):
```
BuildInLime is a construction project-management app for teams who want their site
communication, tasks and documents in one place — and available even without a
signal.

Organise work the way a real project runs. A project breaks down into build units,
and each build unit into channels — focused workstreams for Finance, Requirements,
Design, Materials, Tools, Execution and Experimentation. Messages, tasks and files
live inside the channel they belong to, so nothing is lost in a single endless feed.

WHAT YOU CAN DO
• Message your team in project channels, with threaded replies.
• Create and assign tasks, set status and target dates, and track what is done.
• Attach photos, videos, documents and voice messages to any message or task.
• Keep a clear record per channel — finance, materials, execution and more.
• Work offline: everything you are allowed to see is stored on your device, so the
  app keeps working on site with no connection and syncs when you are back online.

BUILT FOR THE SITE
Construction happens where the network does not. BuildInLime is local-first: reads
come from an on-device copy of your data, and anything you create is saved locally
first and synced to the server when you reconnect. No spinner waiting on a bar of
signal.

DATA OWNERSHIP
Your project data is yours. BuildInLime carries no advertising, no analytics and no
tracking SDKs. What you put in is used only to run the app — never sold, never shared
with advertisers, never used to train AI models. A copy of everything you are allowed
to see is held on your own device, so your record of the project stays readable with
or without a connection. You can request deletion of your account and all of its data
at any time from the Account screen; it is removed within 30 days.

Read the full policy at https://app.buildinlime.com/privacy

BuildInLime is operated by DataConscientious LLP and built by Barefoot Programmers.
```

**App category:** Business (primary). Alternative: Productivity.

**Tags:** project management, construction, collaboration, tasks, offline.

**Contact details (shown on the listing):**
- Email: `support@buildinlime.com`
- Website: `https://buildinlime.com`
- Phone (optional): `0866-2956826`

**Privacy policy URL (required):** `https://app.buildinlime.com/privacy`

---

## Target audience & content

- **Target age group:** 18 and over. (The app is intended for adults — privacy
  policy clause 12. Keeping the target audience 18+ avoids the Families programme
  requirements.)
- **Appeals to children:** No.

### Content rating questionnaire (IARC) — how to answer
The app has **no** violence, sexual, profanity, drug or gambling content. The two
answers that are NOT "no":
- **Users can interact / communicate:** **Yes** — the app has in-app messaging
  between users (channels, replies).
- **Users can share user-generated content:** **Yes** — messages, photos, videos,
  files and voice recordings.
- **Shares user location:** **No.**

Expected result: **Everyone / PEGI 3** with an interactive-elements notice ("Users
Interact", "Shares Info" only if you declare account data — you do not share location
or physical address).

---

## Data Safety form — answers

Full per-field detail is in `PLAY_DATA_SAFETY.md`. Summary of the toggles:

**Does your app collect or share any of the required user data types?** **Yes** (collect only; no sharing).

Data types to declare as **Collected = Yes, Shared = No**:
- Personal info → **Email address** (required; App functionality + Account management)
- Personal info → **Name** (required; App functionality + Account management)
- Photos and videos → **Photos, Videos** (optional; App functionality)
- Files and docs → **Files and docs** (optional; App functionality)
- Audio → **Voice or sound recordings** (optional; App functionality)
- Messages → **Other in-app messages** (App functionality)

Do **NOT** declare (none present): Location, Financial info, Health, Contacts,
Web browsing history, App activity/analytics, Device or other IDs, Crash logs,
Advertising ID.

**Security practices:**
- **Data is encrypted in transit:** **Yes** (TLS to `app.buildinlime.com`; verified
  by `verify-api-url.sh` on the build).
- **Users can request that data be deleted:** **Yes** — in-app Account → "Delete
  account & data"; removed within 30 days.
- **Committed to Play Families Policy:** N/A (target 18+, not in Families).
- **Independent security review:** No.

> The Data Safety declaration must match the privacy policy at
> `app.buildinlime.com/privacy`. Both now say the same thing; keep them in lockstep
> on any future change.

---

## Permission justification (for the "sensitive permissions" review reply)

Only one sensitive permission is declared (`android.permission.RECORD_AUDIO`):

> **Microphone (RECORD_AUDIO):** Used only when the user taps the microphone button
> to record a voice message inside a project channel. Recording is user-initiated
> and never runs in the background. The app has no calling, no background audio, and
> no continuous listening.

`MODIFY_AUDIO_SETTINGS` is a normal (non-sensitive) permission — adjusts audio
route/volume during record/playback; no justification prompt expected.

There is **no** foreground-service permission (background playback was dropped), so
no Foreground Service declaration is required.

---

## Release path (Phase 5 reminder)

Status as of 2026-07-27 — steps 1–3 are done; the live step is **4**.

1. ~~Build `production` from `main`.~~ **DONE** — current artifact is **versionCode 3**
   (build `6555fde1-…`, from `main` @ `9cf4599`).
2. ~~Verify the `.aab`.~~ **DONE** — `verify-api-url.sh` plus the DEX/bundle checks; see
   `ANDROID_RELEASE_PLAN.md` Phase 5 step 1 for the full results.
3. ~~`eas submit` → **Internal testing**.~~ **DONE** (on versionCode 2).
4. **Closed testing — upload versionCode 3.** Do *not* promote the vc2 release sitting
   on Internal testing: it predates the `offline-debug` deep-link fix (`c512592`) and
   must not start the 14-day window. Use `eas submit --profile closed` (Play's built-in
   `alpha` track) or upload the `.aab` by hand.
   - **12 testers, opted in continuously for 14 days** — per Google's
     [testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).
     (`Android_App_Publishing_Plan.docx` says 12–20; that is wrong.) The Console's
     testing-requirements page shows the live counter.
   - The clock counts testers who have **opted in and installed**. Invited is not
     opted in; this is the usual reason the 14 days silently fail to start.
   - Prefer a **Google Group** over a raw email list, so testers can be added later
     without editing the track.
5. Promote to **Production** with a staged rollout. Expect the **RECORD_AUDIO
   justification prompt** — copy is in the Permission justification section above.

Rebuilding costs a versionCode (EAS `autoIncrement` owns the counter), so only rebuild
when the code actually changes — but always rebuild when it does, rather than shipping
a known-stale artifact into the testing window.

---

## Graphics assets — produced 2026-07-28

**These gate the production release, not closed testing.** The Console does not ask for
them when creating a closed-testing release. See the correction in
`ANDROID_RELEASE_PLAN.md` (Phase 4 and the status section) for the citation.

All produced and sitting in **`store-assets/`** — see `store-assets/README.md` for
provenance, regeneration commands and known weaknesses. Upload at
**Grow users → Store presence → Main store listing → Graphics**:
- [x] **App icon** — 512×512 PNG (32-bit, with alpha) → `store-assets/play-icon-512.png`.
      Drawn from `web-app/code/public/favicon.svg`, *not* from `assets/images/icon.png`
      (see the warning below).
- [x] **Feature graphic** — 1024×500 PNG, no transparency → `store-assets/feature-graphic.png`.
- [x] **Phone screenshots** — 5 images, 1080×1920 (9:16) → `store-assets/screenshots/out/`.
      Real captures from a moto g34 5G on the release build, composed onto a brand canvas
      because the device panel is 9:20 and Play requires 9:16.
- [ ] (Optional) 7-inch and 10-inch tablet screenshots — not produced; leave the section
      empty rather than claiming tablet support on the Android listing.

> **The in-app icon was NOT final, contrary to what this doc used to say.**
> `assets/images/icon.png`, the three `android-icon-*` adaptive layers and
> `splash-icon.png` were all still the stock Expo chevron — that is what versionCode 3
> ships and what current testers see on their home screen.
>
> Replaced 2026-07-28 by `store-assets/build_app_icons.py`, and
> `android.adaptiveIcon.backgroundColor` changed from `#E6F4FE` to `#976623`.
> **This has not reached a build yet** — `mobile-app/android/` is gitignored and EAS
> regenerates it at build time, so the launcher icon only changes on the next build.
> Rebuild before production (costs a versionCode) and confirm the icon on-device.
