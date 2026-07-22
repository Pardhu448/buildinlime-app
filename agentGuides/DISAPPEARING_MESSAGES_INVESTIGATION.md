# Investigation: mobile messages disappear when sending media attachments

**Status: RESOLVED. Root cause found, fixed, and confirmed on device 2026-07-22 —
all 13 shapes aborted and all 13 restarted (§11.4b).**

React Native's `AbortController` polyfill has no `signal.reason`, which disables
`@electric-sql/client`'s own restart-after-abort path — so the wake-detection
abort described in §10 killed every in-flight shape long-poll permanently.

**Read §11 first.** §§2–9 are the trail that led there and several of their
conclusions are superseded — §2d, §6.1 and §9.1 in particular chase a "selective
freeze" that turned out to be nothing but which requests happened to be in flight.
They are kept because knowing what was ruled out, and why the wrong readings were
plausible, is most of the value if this ever recurs.

Branch `feat/mobile-audio-video-picture-message` (the fix is commit `e2cff9f`),
with §9.3 and §10.6 on `fix/message-txid-handshake` and §9.4 on
`fix/range-content-length`.

---

## 1. Symptom

On the mobile app, sending a channel comment that carries an **image / video /
file attachment**:

1. The message appears optimistically (you see it), then **the whole message
   bubble disappears** — not just the attachment, the entire message including
   any text typed with it.
2. It happens after a **handful of uploads** in a session (~2–5), then keeps
   happening for every subsequent send.
3. **Text-only messages are fine** until the first media send trips the glitch.
4. It **stays broken until a Metro reload**; a reload restores everything (the
   messages and resources are all present server-side).

Web (same server, same architecture) does **not** exhibit this.

---

## 2. What the data proves (from on-device logs)

Three diagnostics produced everything below. They have since been REMOVED (§5, §15);
reproducing any of these captures means restoring them from git history:

- `[msg-diag]` — logs when a message id ENTERS / LEAVES the live `messages`
  collection, and send/commit timing. (`MessageList.tsx`, `MessageInput.tsx`)
- `[net#N]` — logs every request through the shared `cookieFetch` with an
  **in-flight counter** and duration. (`cookie-fetch.ts`)
- `[shape-retry]` — pre-existing; logs when an Electric shape hits `onError`.

### Decisive observations

**(a) The optimistic row is dropped at commit with nothing to replace it.**
```
[msg-diag] +9cad6cf7 ENTERED (total 35)
[msg-diag] -9cad6cf7 LEFT   (total 34, resources 28)
[msg-diag] committed 9cad6cf7 — starting uploads
```
The message inserts (onMutate), then LEAVES, then the tRPC commit resolves. This
is the normal "drop optimistic at settle, Electric reconciles by id" flow —
EXCEPT the synced row never arrives, so the row just vanishes.

**(b) ALL Electric sync is frozen, not just this message.** The `resources N`
count in the LEFT line stays frozen (e.g. 28, then 37, then 48 across many sends)
— new resources created by the uploads never sync back either.

**(c) Writes succeed; the freeze is read-only.**
```
[net#93] → POST /api/trpc/messages.create (inflight 1)
[net#93] ← /api/trpc/messages.create 200 284ms (inflight 0)
[net#94] → POST /api/resources/upload (inflight 1)
[net#94] ← /api/resources/upload 201 2276ms (inflight 0)
```
tRPC message creates return 200 (~200–300ms); uploads return 201 (~2s). Both fine.

**(d) The freeze is SELECTIVE to the idle-GC'd, screen-scoped shapes.** This is
the sharpest clue and it corrects an earlier misread. Two different captures:

- One post-freeze capture showed `inflight` ≤ 1 and **no** `GET /api/messages` /
  `GET /api/resources` at all — read at the time as "all shapes stopped".
- A later capture shows the opposite for the always-mounted shapes:
  ```
  [net#166] → POST /api/trpc/messages.create (inflight 12)
  [net#167] → POST /api/resources/upload      (inflight 12)
  [net#156] ← /api/seen-state 200 16039ms      (inflight 10)   ← healthy 16s long-poll
  [net#169] → GET /api/seen-state              (inflight 11)   ← immediately re-issued
  ```
  Here `inflight` is **11–12**, and the `seen-state` shape is plainly **healthy**
  (held ~16s, 200, re-issued) — WHILE the message still `LEFT` and `resources`
  stayed frozen at 52.

So Electric is NOT globally dead. `seen-state` is a **`NEVER_GC`** always-mounted
badge shape and it keeps syncing; `messages` and `resources` are **`IDLE_GC_MS`**
screen-scoped shapes and they are the ones that stop delivering. The distinguishing
factor is the **GC tier / lifecycle**, not the network.

**(e) `inflight` is variable, not always ≤ 1** — it was ≤1 in one capture and
11–12 in another. Whether it climbs across a session (a request leak toward the
`maxRequestsPerHost = 32` cap) has NOT been confirmed and is worth measuring
(watch the number over time).

---

## 3. Ruled out (with reasoning)

| Hypothesis | Ruled out because |
|---|---|
| **Connection-pool saturation** (OkHttp) | `inflight` ≤ 1 always; the native `withOkHttpDispatcher` plugin sets `maxRequestsPerHost = 32` and it IS compiled into the build (`android/.../MainApplication.kt` contains `maxRequestsPerHost = 32`). |
| **Uplink / bandwidth starvation by large uploads** | Uploads complete in ~2s; message writes in ~300ms; `inflight` ≤ 1. Nothing is held open or slow. |
| **The message WRITE failing / rolling back** | `messages.create` returns 200 and `tx.isPersisted.promise` resolves ("committed" logs). |
| **expo-video shared-object churn as the sync cause** | The `Cannot use shared object that was already released` error WAS real and is now fixed (lazy players, §4). The freeze persists without it. |
| **Cookie/SecureStore per-request churn wedging sync** | Rewrote `cookieFetch` to an in-memory jar (§4). Freeze persists. |
| **Electric `onError` returning `undefined` → shape teardown** | Plausible and the contract fix is correct (§4), but applying it did NOT fix the freeze. Either shapes don't stop via `onError` (no `[shape-retry]` at onset was captured), or they stop via a different path. |

---

## 4. Changes made this session (and outcome)

All are in the working tree. The **feature work** (inline media) is workstreams
B/C/A; the rest are attempted fixes.

1. **Inline media rendering (workstream B)** — `MessageAttachments.tsx` renders
   image/video/audio inline; new `InlineImage`, `InlineVideo`, `AudioPlayer`,
   `ImageViewerModal`, `media-source.ts`, `mediaKind()` helper. *(feature)*
2. **HTTP Range support (workstream C)** — `fileStorage.ts` `parseRangeHeader` +
   206/416; provider/local/gcs `get(range)`. Tests added. *(feature; correct)*
3. **Composer capture (workstream A)** — `AttachmentMenu`, `AudioRecorderModal`,
   `capture.ts` (camera/library/audio/doc). *(feature)*
4. **Synced-bridge** — upload-manager keeps a message upload as `"synced"` (local
   file retained) until the resource row lands, then `confirmSynced()` purges it;
   `MessageList` drives it; `MessageAttachments` de-dupes by id. **Did not fix.**
5. **Commit-before-upload ordering** — `MessageInput.handleSend` awaits
   `tx.isPersisted.promise` before `start()`ing uploads. **Did not fix.**
   **REVERTED — see §12.**
6. **In-memory cookie jar** — `cookie-fetch.ts` reads SecureStore once, serves
   from memory, writes on change off the response path. **Did not fix** (but a
   real efficiency win; removes per-request encrypted-store I/O).
7. **Lazy media players** — `InlineVideo` now shows a poster + play button and
   mounts a live `expo-video` player only in `VideoPlayerModal` on tap;
   `AudioPlayer` creates its `expo-audio` player only after first tap. **Fixed the
   `Cannot use shared object that was already released` error**; did NOT fix the
   freeze.
8. **Electric `onError` retry contract** — `sync-core/collections.ts`
   `makeShapeRetry`: `retryOnError`/`retryOnMembershipsError` now `return {}`
   (retry) instead of `undefined` (which the current `@electric-sql/client`
   treats as "tear the shape down"). Types threaded through `ShapeRetry`,
   `CollectionRuntime`, `CollectionSpec`. Correct per the library's documented
   contract (`onError`: return object → retry, return void → stop). **Did not fix
   the freeze** — so shapes are likely NOT stopping through `onError`.

Typechecks clean across sync-core / mobile / web; mobile 33/33 unit tests pass.

---

## 5. Diagnostic instrumentation — ALL REMOVED (§15)

These carried the whole investigation and are gone as of §15. Listed because every
log excerpt in this document came from one of them, and reproducing any of it means
putting them back:

- `MessageList.tsx` — `[msg-diag]` ENTER/LEAVE effect. Which id left the live
  collection, and when.
- `MessageInput.tsx` — `[msg-diag]` send log.
- `cookie-fetch.ts` — `[net#N]` request + in-flight counter. Every `[net#…]` line
  quoted below. NOTE it only ever saw traffic through `cookieFetch`: image, video
  and audio bytes were invisible to it (§9.2).
- `infrastructure/offline/wake-probe.ts` — `[wake]` AppState transitions and the
  JS-timer gap, mirroring `@electric-sql/client`'s own wake-detection constants.
  Deleted; recover from git history if the mechanism ever needs re-measuring.

---

## 6. Leading hypotheses for the freeze (unverified)

**The freeze is selective: `IDLE_GC` shapes (`messages`, `resources`, `tasks`,
`properties`) stop delivering while a `NEVER_GC` shape (`seen-state`) keeps
syncing (§2d).** That is the strongest lead — the mechanism must be something that
differentiates those two groups, i.e. the **collection lifecycle**, not the raw
network. Prime suspects, roughly in priority order:

1. **Idle-GC aborting the screen-scoped shape long-polls.** Per ARCHITECTURE
   (§"Garbage collection"), GC fires when a collection has **no mounted live
   query**, and its cleanup **aborts the Electric long-poll**. The media capture
   flow opens native pickers (camera/gallery via `expo-image-picker`) and
   full-screen modals (`AudioRecorderModal`, `ImageViewerModal`, `VideoPlayerModal`)
   that can background the app or unmount the channel screen. If that drops the
   `messages`/`resources` live queries and the GC timer (`IDLE_GC_MS`) fires — or
   if resurrection after GC doesn't resume — exactly those shapes go quiet while
   `NEVER_GC` `seen-state` stays up. **This is the leading theory.** Only the
   idle-GC group is affected, which no other hypothesis explains as cleanly.
   - Verify: does the channel screen / its `useLiveQuery`s unmount when the native
     picker or a media modal opens? Log collection GC/cleanup + resurrection.
   - **CAVEAT:** RN `<Modal>` and native-activity pickers (`launchCameraAsync`)
     do NOT normally unmount the underlying screen or its live queries, and app
     backgrounding doesn't unmount React components — so plain GC-on-unmount may
     NOT fire here. If the live queries stay mounted, the selective freeze is more
     likely a per-shape stall or server-side delivery gap for those specific
     shapes than GC. Confirm mount state before committing to this theory.
2. **Visibility / wake pausing not resuming for GC'd shapes.**
   `@electric-sql/client` has `subscribeToVisibilityChanges_fn` /
   `subscribeToWakeDetection_fn` and a `_pauseLock` / `PausedState`. Backgrounding
   for the camera could pause streams; if resume misfires for the resurrected
   (idle-GC) shapes but not the always-mounted ones, same selective symptom.
3. **Fast-loop guard / pause.** `_fastLoopThreshold`, `_fastLoopMaxCount`,
   `checkFastLoop_fn`. If rapid writes trigger rapid shape re-requests, the
   fast-loop detector may pause a stream silently.
4. **`must-refetch` / truncate loop** (`electric.js`).
5. **expo-sqlite persistence stall** between polls (shared DB contention:
   Electric persistence + outbox + upload-manager `pending_attachments`).

NOTE: an earlier framing ("shapes stop, `inflight` 0, loop not blocked on fetch")
was based on the ≤1 capture; the 11–12 capture shows `seen-state` polling fine, so
the loop is NOT globally dead — reframe around the selective (GC-tier) freeze.

---

## 7. Next diagnostic steps

1. **Confirm the selective freeze and pin the moment.** Filter `[net#]` to shape
   GETs and watch which PATHS keep cycling. Expectation from §2d: `GET
   /api/seen-state` (and other `NEVER_GC` badges) keep returning+re-issuing, while
   `GET /api/messages` and `GET /api/resources` stop. Capture the send where they
   go quiet, plus any `[shape-retry]` / `[Electric]` warn lines at that instant.
2. **Test the GC/lifecycle theory directly (leading hypothesis).**
   - Log mount/unmount of the channel screen and its `useLiveQuery`s
     (`useMessages`, the resources live query in `MessageList`) — do they unmount
     when the native camera/gallery picker opens, or when a media modal
     (`AudioRecorderModal` / `ImageViewerModal` / `VideoPlayerModal`) mounts?
   - Log collection GC/cleanup + resurrection for `messages`/`resources`.
   - If GC-on-picker is the cause: keep those collections mounted across the
     capture flow (e.g. a retaining subscription for the duration), or raise their
     GC tier, or ensure resurrection resumes the long-poll.
3. **Isolate render vs write path.** Does it still freeze if inline media is
   reverted to plain download chips (no `InlineImage/Video/Audio`, no pickers'
   modals)? If NO → it's the media UI (picker/modal unmounting the screen → GC).
   If YES → it's the upload/write path. This one test cuts the search space in half.
4. **Instrument the shape lifecycle.** Log inside `onError`, and around the
   client's pause/visibility/wake and `checkFastLoop` transitions (via a wrapper
   or patch) to distinguish PAUSE vs teardown vs GC-abort.
5. **Watch `inflight` over a whole session** — does it climb toward 32 (a request
   leak → cap saturation), or stay ~11? §2e is unresolved.
6. **Check library versions.** `@electric-sql/client`,
   `@tanstack/electric-db-collection`, `@tanstack/db` — did GC/pause/onError
   behavior change vs when this code was written? A version bump is a plausible
   origin for a latent lifecycle bug.

---

## 8. Key files

- `packages/sync-core/src/collections.ts` — `makeShapeRetry`, `CollectionRuntime`,
  `buildCollectionOptions` (wires `fetchClient` + `onError` into shapes).
- `mobile-app/src/application/collections/communication.ts` — collection
  factories, init/reset, idle-GC tiers (`resourcesSpec` = `IDLE_GC_MS`).
- `mobile-app/src/application/collections/_shared.ts` — `defineCollection`,
  shared `cookieFetch`, parser.
- `mobile-app/src/infrastructure/auth/cookie-fetch.ts` — in-memory cookie jar +
  `[net#]` instrumentation.
- `mobile-app/src/infrastructure/offline/upload-manager.ts` — pending uploads,
  synced-bridge, `confirmSynced`.
- `mobile-app/src/presentation/messages/components/MessageInput.tsx` /
  `MessageList.tsx` — send flow + `[msg-diag]`.
- `web-app/code/src/infrastructure/storage/fileStorage.ts` — server upload
  handler (15s parent-poll, buffers file, inserts resource + raw) and range serve.
- Server session: `web-app/code/src/infrastructure/auth/server.ts` —
  `cookieCache: { enabled: true, maxAge: 50 }` (frequent `Set-Cookie`).

---

## 9. Second pass — code-trace findings (no device needed)

Four results from reading the code against the guides. (1) corrects §2d's framing,
(2) kills a suspect, (3) is the reason a stall becomes a *disappearing* message and
is fixable on its own, (4) is a latent bug in the new Range code.

### 9.1 §2d's "GC tier" conclusion is a CONFOUND — the same split is server-side

§2d concludes the distinguishing factor between the frozen shapes (`messages`,
`resources`) and the healthy one (`seen-state`) is the GC tier. It is not the only
thing that splits them that way. On the server, `shape-route.ts` runs
`resolveMemberScope(userId)` — **two Postgres queries against `membership` and
`channels` on EVERY long-poll** — but only for descriptors that declare
`scope: "member"`. From `web-app/code/src/infrastructure/database/shapes.ts`:

| Shape | `scope: "member"`? | GC tier | Observed |
|---|---|---|---|
| `messages`, `resources`, `tasks`, `properties` | **yes** | `IDLE_GC_MS` | frozen |
| `seen-state` | **no** (`where: user_id = me`, session only) | `NEVER_GC` | healthy |

Both axes partition the evidence identically, so §2d cannot tell them apart. Its
own CAVEAT (RN `<Modal>` and `launchCameraAsync` do not unmount the screen, so GC
should never fire) argues against the GC reading; the server-scope axis has no such
problem.

**Free discriminator, already shipped, no new instrumentation.**
`inboxMentionsCollection` and `myTasksCollection` are `NEVER_GC` **and**
`scope: "member"` (see `inbox-mentions.ts` / `my-tasks.ts` routes), and they drive
the always-mounted DrawerContent badges. During a freeze:

- Badges keep updating → server scope/pool is fine → the GC/lifecycle theory (§6.1)
  survives and is the thing to instrument.
- Badges freeze too → GC is **out**; the fault is on the `scope: "member"` axis —
  `resolveMemberScope`, the `pg` pool (`connection.ts`, `max = 10`), or the
  Electric proxy. Chase the server, not the RN lifecycle.

Note `seen-state` differs on a third axis too: it is initialized during BOOTSTRAP
and is the one channel-adjacent collection `resyncProjectCollections()` never
rebuilds. That path is guarded (it only runs on a membership-set change, with the
authenticated tree unmounted) and an upload changes no memberships, so it is
unlikely — but it is a third explanation for the same evidence, which is the point:
§2d's evidence is not decisive.

### 9.2 RULED OUT: native media loaders cannot starve the shape long-polls

The obvious shape of a media-only bug is "inline images/video eat the OkHttp
dispatcher slots that §1 of `shapeConcurrencyAndLazySync.md` fought for". Checked
directly against the installed sources — it cannot happen:

- `MainApplication.kt`'s `BuildInLimeOkHttpClientFactory` mints a **new
  `Dispatcher()` on every `createNewNetworkModuleClient()` call**, so every client
  built through it has its own independent slot pool.
- RN's Fresco pipeline calls `OkHttpClientProvider.createClient()`
  (`react-native/.../modules/fresco/FrescoModule.kt:156`), which routes through
  that factory → **its own client and dispatcher**. `<Image source={{uri, headers}}>`
  in `InlineImage`/`ImageViewerModal` does not touch the networking module's slots.
- expo-video builds `OkHttpClient.Builder().build()` itself
  (`expo-video/.../utils/DataSourceUtils.kt`) → a third, wholly separate client.

**Corollary worth keeping:** the `[net#]` in-flight counter only sees traffic
through `cookieFetch`. Image, video and audio bytes are invisible to it. Do not
read `inflight` as total device network load.

### 9.3 ROOT CAUSE of the *visible* symptom: there is no txid handshake

> **RESOLVED — see §13.** The handshake is implemented in both apps on branch
> `fix/message-txid-handshake`. The analysis below stands as written.

Independent of why sync stalls, this is why a stall shows up as the bubble
**vanishing** rather than the attachment merely being late.

`packages/sync-core/src/mutation-fns.ts` (header comment, lines 15–37) deliberately
does **not** call `collection.utils.awaitTxId(result.txid)`; `createMessage` awaits
the tRPC mutation and returns nothing. Messages go through
`@tanstack/offline-transactions`, and `messagesSpec` passes no `onInsert`, so
electric-db-collection's own txid wait never engages either.

Consequence: `tx.isPersisted.promise` resolves the instant `messages.create`
returns 200, the optimistic row is dropped, and **the bubble's existence from that
moment depends entirely on the messages shape delivering the synced row.** That is
exactly the `+id ENTERED … -id LEFT … committed` sequence in §2a — it is not a
symptom of the freeze, it is the designed behaviour. The freeze only removes the
row that was supposed to arrive milliseconds later.

The comment's stated premise — *"the brief pre-reconciliation window has never
produced an observable flicker"* — is precisely what this bug falsifies. Two
consequences:

- Change §4.5 (`handleSend` awaits `tx.isPersisted.promise` before `start()`ing
  uploads) **widens** this window: the row is now guaranteed to be dropped *before*
  any upload traffic begins, instead of racing it.
- Re-adding the handshake makes the message survive any stall shorter than the
  `awaitTxId` timeout, and turns a silent vanish into a bounded wait. The comment
  already spells out how to do it safely: keep it OUT of the retriable try/catch and
  swallow the 5s timeout (the server has committed; rethrowing rolls back a
  successful write, and retrying re-issues it). Its remaining caveat — "skip it when
  the collection is idle-GC'd, since GC aborts the shape stream that would carry the
  txid" — is satisfied while the channel screen is open, because a mounted live
  query is what stops `messages` GC'ing in the first place.

This is worth doing on its own merits even if the freeze turns out to have an
unrelated cause: it converts an unbounded data-loss-looking symptom into a bounded
one, and it is the only change here that makes the UI honest about what happened.

### 9.4 Latent bug in the new Range path: `content-length` comes from the DB, not storage

`fileStorage.ts:262` — `const totalSize = Number(raw.file_size_bytes)`. That DB
number is then used for the `416` clamp, `content-range`'s denominator, and the
`content-length` on **both** the 206 and the 200 response. Meanwhile
`StorageProvider.get()` returns the object's real `size` (`local.ts` → `stat.size`,
`gcs.ts` → `metadata.size`) and `serveResourceFile` **discards it**.

While the two agree this is invisible. When they disagree — a row predating the
object-storage migration, a re-uploaded object, a truncated write — the server
declares more bytes than it streams, and an HTTP/1.1 client sits waiting on a body
that never completes. On mobile that is a held-open connection in whichever
OkHttp client fetched it.

Fix is cheap: trust `obj.size` for the served length, and treat a mismatch with
`raw.file_size_bytes` as a logged warning. `tests/unit/range-header.test.ts` covers
the parser but not this, because the parser never sees the storage object.

### 9.5 Revised next steps

1. **Run the §9.1 discriminator first.** It costs one freeze reproduction and no
   code, and it eliminates either the whole of §6 or the whole server side. Every
   other diagnostic below is cheaper once it is answered.
2. **Fix §9.3 regardless of the outcome** — it is a real defect with an
   independent fix, and it changes the symptom from "message gone" to "message
   waits", which makes every subsequent repro easier to read.
3. §7.3 (revert inline media to download chips) is still the right search-space
   halver, but run it AFTER §9.1 — if the badges freeze too, the media UI is
   already exonerated and the test is wasted.
4. §7.5 (`inflight` over a session) is now known to be blind to image/video/audio
   traffic (§9.2). Read it as "cookieFetch requests outstanding" only.
5. Fix §9.4 while in the file.

---

## 10. LEADING HYPOTHESIS: Electric's wake-detection aborts every shape when the
## camera backgrounds the app

Found by tracing the 2026-07-21 capture (§10.1) into the installed
`@electric-sql/client@1.5.15`. This supersedes §6 as the leading theory: it is a
mechanism in shipped library code, not a guess, and it explains every observation
including the mobile/web asymmetry, which nothing in §6 does.

### 10.1 What the new capture actually says

```
[msg-diag] send 0c36fd2b with 1 upload(s) — awaiting commit
[msg-diag] +0c36fd2b ENTERED (total 69)
[net#55] → POST /api/trpc/messages.create (inflight 13)
[net#55] ← /api/trpc/messages.create 200 822ms (inflight 12)
[msg-diag] -0c36fd2b LEFT (total 68, resources 60)
[msg-diag] committed 0c36fd2b — starting uploads
```

Three things fall out, and two of them close open questions:

- **§2e is resolved: `inflight 13` is the HEALTHY state.** The app holds 13
  collections (memberships, projects, users, buildunits, channels, channelMembers,
  tasks, messages, resources, properties, inboxMentions, myTasks, seenState), each
  parked on a long-poll. 12–13 outstanding *is* steady state; it is not a leak and
  not saturation. The pathological capture was the **`inflight ≤ 1`** one — that is
  the signature of shapes that have stopped issuing requests at all.
- **The upload is not the trigger.** `LEFT` lands after the tRPC 200 and *before*
  `committed → starting uploads`. Not one byte of the video had been uploaded when
  the message vanished. This directly falsifies the rationale written into §4.5
  ("a large upload saturates the phone's uplink … starves this message's own tRPC
  POST"): the POST completed in 822ms with nothing uploading.
- It happened on the **first** video send of the session, not after 2–5.

So whatever kills sync happens **before the send**, during capture — and §9.3 is
the mechanism that turns that into a vanished bubble.

### 10.2 The mechanism

`@electric-sql/client` picks one of two lifecycle strategies per stream, keyed on
whether the browser visibility API exists (`dist/index.mjs`, `hasBrowserVisibilityAPI_fn`):

```js
hasBrowserVisibilityAPI_fn = function () {
  return typeof document === `object` && typeof document.hidden === `boolean`
      && typeof document.addEventListener === `function`
}
```

**React Native has no `document`.** So on mobile:

- `subscribeToVisibilityChanges_fn` — the *graceful* path, which acquires the
  pause lock on hide and releases it on show — is **never installed**.
- `subscribeToWakeDetection_fn` — the fallback for Node/Bun — **is** installed, on
  all 13 streams. It is a per-stream `setInterval(…, 2000)` that measures wall-clock
  drift, and when a tick is more than `INTERVAL_MS + WAKE_THRESHOLD_MS` = **6s**
  late it does this:

```js
if (elapsed > INTERVAL_MS + WAKE_THRESHOLD_MS) {
  if (!this.#pauseLock.isPaused && this.#requestAbortController) {
    this.#requestAbortController.abort(SYSTEM_WAKE)   // ← kills the in-flight long-poll
  }
}
```

Its own docblock says it exists because *"in-flight HTTP requests (long-poll or SSE)
may hang until the OS TCP timeout"* after a laptop sleeps. The assumption is a
desktop process. On Android the same wall-clock gap is produced by something far
more routine:

`react-native/.../modules/core/JavaTimerManager.kt`:

```kotlin
override fun onHostPause() {
  isPaused.set(true)
  clearFrameCallback()      // JS timers stop firing while the activity is paused
}
```

RN drives JS timers off the Choreographer and **stops them whenever the activity is
paused**. `expo-image-picker`'s `launchCameraAsync` / `launchImageLibraryAsync` and
`pickDocument` all start a *separate Android activity*, which pauses ours. So does
pressing Home.

Chain: **open the camera → our activity pauses → JS `setInterval`s freeze → return
after >6s → all 13 wake-detection timers fire at once, each sees a ~10s gap, and
each aborts its in-flight long-poll simultaneously.**

### 10.3 Why this fits every observation

| Observation | Explained |
|---|---|
| Only media sends break it; text-only never does | Only the media flows launch another activity. Typing never leaves the app. |
| **This run: the FIRST video send** | Recording a video reliably takes >6s. Snapping a photo can take <6s — which is exactly why photos took "2–5 sends" to trip it and a video took one. The threshold is a stopwatch, not a counter. |
| Web never exhibits it | Browsers have `document` → they get the graceful visibility path and **wake detection is never installed at all**. This is the cleanest available explanation of the mobile/web asymmetry. |
| "All ten shapes aborted at the same instant" (`mobileUiAndShapeBudget.md` §7) | *Same instant* is the signature: every stream measures the same wall-clock gap. That guide's observed hazard now has a mechanism. |
| Stays broken until a Metro reload | The one-way door (`shapeConcurrencyAndLazySync.md` §2, `mobileUiAndShapeBudget.md` §7): sync starts once via `startSyncImmediate()` and nothing re-arms it. A reload rebuilds the ReactInstance and starts fresh. |
| §2d's "selective" freeze | The abort is guarded by `if (… && this.#requestAbortController)` — it only fires on a stream with a request **in flight**. Any stream that happened to be between polls at that moment is untouched. That selectivity is **random timing, not GC tier** — which is the third and best reason to stop trusting the §2d framing (see §9.1). |
| `inflight ≤ 1` in one capture, 12–13 in another | ≤1 = post-abort, streams dead. 12–13 = the survivors still parked. Both are consistent; they were captured at different points. |
| No `[shape-retry]` line at onset (§3) | An `AbortError` is not routed through `onError`. This is also why fix §4.8, correct as it is, changed nothing: the shapes are **not** dying through `onError`. |

### 10.4 THE DECISIVE TEST — 30 seconds, no code, no upload

**Background the app for 10+ seconds and send a plain text message.**

1. Open a channel. Confirm sync works (send a text message; it stays).
2. Press **Home**, wait ~10s, reopen the app. (Or open the camera and back out
   without taking anything — do not attach, do not upload.)
3. Send a **text-only** message.

- **It vanishes** → confirmed. The bug is the background gap, not uploads, not
  media rendering, not the composer. Everything in §7.3 and most of §6 is moot.
- **It stays** → this theory is dead; fall back to §9.1's badge discriminator.

Watch `[net#]` across step 2: the signature is a cluster of shape GETs ending at
once on resume, followed by silence.

### 10.5 The fix

Do not try to suppress wake detection — it is private and keyed only on
`hasBrowserVisibilityAPI`, so there is no supported knob. Fix the **one-way door**
instead, which both guides already list as prerequisite work:

Subscribe to RN's `AppState`, and on the `background → active` transition re-arm
every collection **in place** — `cleanup()` then `startSyncImmediate()` on the same
instance. Restarting in place rather than rebuilding is what
`shapeConcurrencyAndLazySync.md` §2 prescribes, and it sidesteps the offline
executor's by-value capture entirely (no `resetAllOfflineActions` /
`initOfflineExecutor` rebind needed). Persistence means the restart resumes from the
saved offset rather than refetching the shape.

Sequencing note: this also unblocks the shape registry, which both guides say must
not be built until a stopped shape can be restarted.

Ship §9.3 (the txid handshake) alongside it. Re-arming fixes the cause; the
handshake means that if sync ever stalls again for any reason, the message waits
visibly instead of silently disappearing.

### 10.6 Also worth fixing: the shape `where` string is not order-stable

Found while checking whether a changed `where` could be re-keying shapes. Not part
of the theory above, but a real latent defect on the same code path.

`shape-where.ts` documents the stakes itself — *"a changed string is a new Electric
shape, a new handle, and a full refetch for every client"* — and notes that
`/api/memberships` is deliberately designed so its string never changes. But
`idSetWhere` interpolates ids **in the order it receives them**, and for
`messages`/`resources`/`tasks`/`properties` that order comes from
`resolveMemberScope`: two `SELECT`s with **no `ORDER BY`**, merged through `Set`
insertion order. Postgres does not guarantee a stable row order across executions.
If it ever changes, the `where` string changes, and every affected client takes a
full refetch.

One-line fix: sort in `resolveMemberScope` before returning
(`[...channelIds].sort()` etc.). Cheap, and it makes the shape identity
deterministic by construction rather than by luck.

---

## 11. ROOT CAUSE: RN's `AbortController` has no `signal.reason`, so Electric's
## own restart-after-abort path can never fire

§10 identified the right trigger and stopped one step short of the defect. Electric
**is** built to survive a wake abort — it re-issues the long-poll immediately. The
bug is that on React Native the recovery branch is unreachable, so the abort is
silently terminal instead of transient.

Everything below is read from installed code, not inferred.

### 11.1 The chain

1. **Wake detection is installed, and only on mobile.**
   `@electric-sql/client@1.5.15` `dist/index.mjs:2915` — `#hasBrowserVisibilityAPI`
   tests `typeof document`. RN has no `document` (nothing in `mobile-app/src`
   polyfills one), so `#subscribeToVisibilityChanges` (the graceful pause path) is
   skipped and `#subscribeToWakeDetection` (line 2946) is installed from `#start`
   on every stream — all 13 collections.

2. **It aborts every in-flight long-poll on a >6s timer gap.** Lines 2949–2959:
   `INTERVAL_MS = 2000`, `WAKE_THRESHOLD_MS = 4000`, then
   `this.#requestAbortController.abort(SYSTEM_WAKE)`. Android produces that gap
   whenever another activity pauses ours — `expo-image-picker`'s camera/gallery,
   `pickDocument`, or the Home button — because `JavaTimerManager.onHostPause`
   stops JS timers.

3. **`#requestShape` is written to restart from exactly that abort** —
   `index.mjs:2412`:
   ```js
   const abortReason = requestAbortController.signal.reason
   const isRestartAbort = requestAbortController.signal.aborted &&
     (abortReason === FORCE_DISCONNECT_AND_REFRESH || abortReason === SYSTEM_WAKE)
   if ((e instanceof FetchError || e instanceof FetchBackoffAbortError) && isRestartAbort) {
     return this.#requestShape()      // ← re-arms the shape
   }
   if (e instanceof FetchBackoffAbortError) return   // ← silent, permanent stop
   ```

4. **`signal.reason` does not exist on React Native.** RN 0.83.4 installs
   `abort-controller@3.0.0` as the global (`react-native/Libraries/Core/setUpXHR.js:38-39`).
   That package predates the `reason` argument: `abort()` at
   `dist/abort-controller.js:90` takes **no parameters**, `abortSignal()` only flips
   a boolean in a WeakMap, and `AbortSignal.prototype` defines `aborted` and nothing
   else.

So `controller.abort(SYSTEM_WAKE)` discards its argument, `abortReason` is
`undefined`, `isRestartAbort` is `false`, and the next line returns. The stream
stops with **no error, no `onError` call, no teardown, no log line** — and nothing
re-arms it short of a Metro reload.

`ShapeStream.forceDisconnectAndRefresh()` (line 2157) aborts with
`FORCE_DISCONNECT_AND_REFRESH` and hits the identical dead branch, so any
refresh-driven path was silently broken on mobile too.

### 11.2 Why this fits everything, including what §6/§9/§10 could not

| Observation | Explained |
|---|---|
| No `[shape-retry]` at onset (§3) | `FetchBackoffAbortError` returns *before* reaching `onError`. This is also why §4.8's `onError` contract fix — correct in itself — changed nothing: the shapes were never dying through `onError`. |
| The "selective" freeze (§2d) | The abort is guarded by `if (… && this.#requestAbortController)` — it only fires on a stream with a request **in flight** at that instant. Streams between polls survive. Random timing, **not** GC tier and **not** the `scope: "member"` axis. §2d, §6.1 and §9.1 are all superseded. |
| `inflight ≤ 1` vs 12–13 (§2e) | ≤1 = post-abort, streams dead. 12–13 = survivors still parked. Both captures consistent. |
| Web never exhibits it | Two independent reasons: browsers have `document` (wake detection never installed) **and** a spec-complete `signal.reason`. |
| Stays broken until a Metro reload | The one-way door (`mobileUiAndShapeBudget.md` §7) — now with a precise mechanism rather than "any abort". |
| Text-only sends are fine until the first media send | Only the media flows start another activity. |
| First video send tripped it; photos took 2–5 | The threshold is a stopwatch (>6s), not a counter. |

### 11.3 The fix (applied)

`src/infrastructure/polyfills/abort-signal-reason.ts` — restores `signal.reason`
by wrapping `AbortController.prototype.abort`, stamping the reason on the signal
**before** delegating (the original dispatches `abort` synchronously, so listeners
must already be able to read it). Installed from `app/_layout.tsx` at module load,
before any `ShapeStream` is constructed.

Three deliberate choices:

- **Repair the library's own recovery rather than add a second one.** §10.5
  proposed an `AppState` re-arm — `cleanup()` + `startSyncImmediate()` on the
  `background → active` transition. That is a workaround layered on a mechanism
  that already exists and works; it would also re-arm streams Electric had
  correctly left alone. Prefer it only as defence-in-depth if §11.4 shows the
  polyfill is insufficient.
- **`abort()` with no argument still leaves `reason` undefined**, though the spec
  says it should be an `AbortError` `DOMException`. Fabricating one risks flipping
  `if (signal.reason)` checks in libraries that have only ever seen `undefined` on
  this platform. The polyfill is purely additive.
- **Self-disabling.** It probes for native support first, so it no-ops the moment
  React Native ships a spec-complete `AbortController` — no double-wrapping on a
  future upgrade.

Covered by `tests/abort-signal-reason.test.ts` (5 tests), which stands up a
faithful `abort-controller@3.0.0` stand-in and swaps it into the global — Node's
native `AbortController` already supports `reason`, so without the stub every
assertion would pass for the wrong reason. Mobile suite 38/38, typecheck clean.

### 11.4 CONFIRMED on device (2026-07-22)

A media-send session with the polyfill in place produced the decisive event. Device
clock 01:55:59, `wake-probe.ts` and the `[net#]` counter both live:

```
[wake] 01:55:59.830 GAP 14648ms — Electric WOULD ABORT every in-flight shape long-poll here
...
[net#44] ✗ /api/resources THREW after 15361ms (inflight 9): AbortError: Aborted
[net#54] → GET /api/resources (inflight 10)          ← re-issued in the same tick
```

`net#44` was the `/api/resources` long-poll, genuinely **in flight** when the wake
timer fired, so it took the `abort(SYSTEM_WAKE)` and surfaced as `AbortError`. With
`signal.reason` populated, `#requestShape` matched `isRestartAbort` and re-issued it
as `net#54` immediately. **Before the polyfill that abort landed in `if (e instanceof
FetchBackoffAbortError) return` and `/api/resources` never polled again** — which is
exactly §2b's original symptom, the frozen `resources` counter.

Three corroborating details:

- **Zero `[shape-retry]` lines in the whole 1331-line capture.** Recovery happened
  without `onError` ever being called, as §11 predicts — and the reason fix §4.8
  could never have helped.
- **`resources` advances again**: `resources 62 → 64 → 65` across successive sends,
  then steady state at 13 shapes cycling cleanly at ~20s, `inflight` 12–13.
- Six media sends (`ab0e8492`, `e16054eb`, `9b8fcabb`, `0c926a5a`, `fae8c2d9`, and
  `1201ac13` with 3 uploads) all committed 200/201.

**The same capture reproduces §2d's "selectivity" live, and explains it.** An earlier
gap in the same session aborted *nothing*:

```
[wake] 01:55:34.056 GAP 13662ms — …
```
All 13 polls had returned **200 at ~33s just before** it — the OS delivered the parked
responses on resume, `inflight` drained 12→0, and all 13 re-issued normally. No
request was in flight when the timer ticked, so `#requestAbortController` was already
cleared and the abort was skipped by its own guard. Same trigger, same instant, 25
seconds apart: one gap aborted nothing, the next aborted exactly one stream. That is
**random timing** — final confirmation that the GC-tier (§2d/§6.1) and
`scope: "member"` (§9.1) framings were both confounds.

Caveat on what this does and does not prove: a Metro reload alone has always restored
sync (§1.4), so "it works after a reload" is worth nothing on its own. What proves it
is the abort→restart pair above, captured *after* the reload.

### 11.4a The reproduction window is 6–20s — longer does NOT work

A 2026-07-22 run pressed Home and waited 71 seconds. It measured the mechanism
beautifully and exercised **nothing**:

```
06:18:38.239  appstate active → background
06:19:49.495  appstate background → active
06:19:49.505  GAP 72048ms
[net#254] ← /api/messages 200 90678ms (inflight 12)
… all 13 return 200, inflight drains 13 → 0, all 13 re-issue …
```

Zero aborts. The log is also completely silent for those 71 seconds — not one interval
tick — which is `JavaTimerManager.onHostPause` stopping JS timers, confirmed by direct
measurement rather than inference.

**Why nothing aborted, and why it matters:** the wake abort is guarded by
`if (… && this.#requestAbortController)` — it only fires on a request that is still
open. The server releases a long-poll after **~20s**. Background for longer than that
and every request has already been answered before you return; the responses sit in
the native layer waiting for JS, and aborting a settled request is a no-op. Note the
GAP line lands *after* the first response was processed — the event loop was already
draining resolutions when the timer fired.

So the window in which a stream can actually be killed is:

> **older than 6s** (`INTERVAL_MS + WAKE_THRESHOLD_MS`, or the timer never fires)
> **and younger than ~20s** (or the poll has already been answered)

This also retires the "caught it by luck" reading of §11.4. That capture's gaps were
13.6s and 14.6s — both inside the window. The first aborted nothing because its polls
had *just* been answered; the second caught `/api/resources` 15.4s into a fresh poll.
Not luck: the right duration.

**Recipe — two short trips.** One trip is not enough, because the first gap's job is
to flush the stale polls and issue fresh ones:

1. Press Home, wait **~10s**, return. Drains the old polls; 13 fresh ones go out.
2. Within the next ~15s, press Home again, wait **~10s**, return. Those polls are now
   mid-flight, so the wake timer aborts them.

Watch the second trip for `AbortError` immediately followed by a re-issued `GET` on
the same path. If a path aborts and never returns, the polyfill is not working. If a
message vanishes *while* shape GETs resume, the sync layer recovered and the UI did
not — that is §9.3, not this.

Incidentally this is why the bug felt so erratic in normal use: the camera and picker
flows produce exactly these short, repeated backgrounds.

### 11.4b DELIBERATE confirmation — all 13 shapes aborted and all 13 restarted

Ran the two-trip recipe on 2026-07-22. This is the decisive result; §11.4 was the
same thing caught opportunistically on one stream.

**Trip 2 — the test.** Backgrounded 06:26:48 → 06:26:59:

```
[wake] 06:26:59.476 GAP 12007ms
[net#564] ✗ /api/my-tasks    THREW after 12290ms: AbortError: Aborted
[net#576] → GET /api/my-tasks (inflight 13)
[net#554] ✗ /api/memberships THREW after 12705ms: AbortError: Aborted
[net#577] → GET /api/memberships (inflight 13)
[net#553] ✗ /api/projects    THREW after 13678ms: AbortError: Aborted
[net#578] → GET /api/projects (inflight 13)
```

**All 13 shapes aborted, all 13 re-issued on the same path**, `inflight` never below
12 and straight back to 13. Poll ages 12.3–13.7s — squarely in the window. This is
`isRestartAbort` firing: the branch that was unreachable before the polyfill, in
exactly the scenario `mobileUiAndShapeBudget.md` §7 recorded as *"all ten shapes
aborted at the same instant and not one reconnected"*.

**Trip 3 confirmed the other half by accident.** A third background (`GAP 13938ms`)
aborted nothing, because the polls restarted in trip 2 were ~29.8s old by then —
past the 20s hold, already answered:

```
[net#566] ← /api/users 200 29878ms   … all 13 return 200, zero aborts
```

So one capture contains both predicted cases. Sync then settled back to a clean 20s
cadence at `inflight` 13.

**Incidental: the polyfill's self-disabling guard turned out to be load-bearing.**
The `[wake]` lines came out doubled — two `appstate` lines per transition, two GAP
lines with different elapsed values (12007 / 11169) — i.e. two live module instances,
so `installAbortSignalReasonPolyfill()` ran twice. The second call found
`signal.reason` already working and returned early rather than double-wrapping
`abort`. That guard was written speculatively; keep it.

### 11.5 Still outstanding, independent of this

- ~~**§9.3 — no txid handshake.**~~ **DONE — §13.**
- ~~**§10.6 — `resolveMemberScope` has no `ORDER BY`.**~~ **DONE — §14.**
- ~~**§9.4 — `content-length` from `raw.file_size_bytes` instead of `obj.size`.**~~
  **DONE, but on a different branch** — `fix/range-content-length`, which is a
  sibling of this one rather than an ancestor, so the fix is not in this tree.
- ~~**Diagnostics stay until the deliberate run.**~~ **DONE — the deliberate run is
  in §11.4b and all instrumentation was removed in §15.**

---

## 12. Cleanup after the fix (2026-07-22)

Once §11 landed, everything added while chasing the bug was re-judged on its own
merits rather than on whether it had been *tried*. Three outcomes.

### 12.1 Reverted

**§4.5 commit-before-upload.** `handleSend` no longer awaits
`tx.isPersisted.promise` before releasing uploads; it fires `start()` as soon as
the transaction exists, as it did before the branch. Two reasons:

- Its stated rationale is falsified. The comment argued a large upload starves the
  message's own tRPC POST — §10.1 shows the row was dropped after an **822ms** POST
  with not one byte uploaded.
- The guarantee it tried to provide is already the server's. `fileStorage.ts` polls
  up to **15s** for the parent message row before giving up, which is exactly what
  makes an upload that overtakes its message safe.

Removing the await also un-breaks an inconsistency it introduced: the `await` sat
inside `if (uploadIds.length > 0)`, so a text-only send never observed
`isPersisted` at all and its rejection would have gone unhandled.

### 12.2 Kept, with the reasoning corrected

These were all written under the old theory. The code is sound; the comments
asserted a cause that turned out to be wrong, which is worse than no comment
because it sends the next reader down a dead trail.

| Change | Verdict | Comment corrected to say |
|---|---|---|
| §4.8 `onError` returns `{}` | Correct and load-bearing — verified in `#start`: a non-object return falls through to `#sendErrorToSubscribers` + `#teardown` | …but aborts never reach `onError`, so this was never the bug; kept for the next genuine shape error |
| §4.6 in-memory cookie jar | A real efficiency win | …not a sync fix; the keystore-churn-wedges-sync theory was wrong |
| §4.4 synced-bridge (`"synced"` + `confirmSynced`) | Kept as ordinary optimistic UI | …the *long* blanking it was built for was the freeze; the sub-second gap it still prevents is real |
| §4.7 lazy media players | Kept — fixed a genuine `Cannot use shared object that was already released` crash | unchanged |

### 12.3 Kept as-is

Feature work (§4.1 inline media, §4.2 Range support, §4.3 composer capture) and the
diagnostics — `[msg-diag]`, `[net#]`, `wake-probe.ts` — which stay until the
deliberate long-background re-test in §11.4 is clean. See §11.5.

Verification after cleanup: mobile 38/38, mobile and web typecheck clean.

---

## 13. The txid handshake (§9.3), implemented

Branch `fix/message-txid-handshake`, stacked on the §11 fix.

### 13.1 What changed

`createMessage` no longer resolves when tRPC returns 200. It captures the `txid`
the router already returns and waits for Electric to deliver the row carrying it,
so the optimistic row is held until the synced row exists to replace it. The
window §9.3 describes is closed rather than narrowed.

Nothing new had to be built server-side: every mutation router already calls
`generateTxId(tx)` and returns `{ item, txid }`. The client was discarding it.

### 13.2 The wiring, and why it is a function

`sync-core` is framework-free and cannot import either app's collections, so the
capability is injected, exactly as `fetchClient` and `retryOnError` already are:

```ts
makeCoreMutationFns(trpc, {
  awaitTxId: { messages: (txid) => messagesCollection.utils.awaitTxId(txid) },
})
```

**It must be an arrow function, not a captured collection.** Both apps export
collections as `export let` and REASSIGN them on project switch / resync; a
captured value pins a stale, cleaned-up instance whose shape is gone. This mirrors
the `getCollection: () => xCollection` idiom already used in `actions/*`, and it is
the same by-value hazard §10.5 flagged for the offline executor.

The hook map is keyed by entity (`messages | tasks | resources | properties |
teams` — all five routers return a txid), so wiring another later needs no API
change: capture `result.txid`, then `await settleTxId("<entity>", txid)` after the
try/catch. Only `messages` is wired today; every other entity keeps the old
settle-on-200 behaviour.

Wired on **both** apps. Web never exhibited the vanish, but its projects /
build-units / channels have always run this same handshake — leaving messages out
would be an asymmetry with no principle behind it.

### 13.3 The three rules, and the one that bites

Recorded in the `mutation-fns.ts` header and pinned by
`web-app/code/tests/unit/mutation-txid-handshake.test.ts` (6 tests):

1. **The await sits OUTSIDE the retriable try/catch.** A timeout carries no
   `.data.code`, so routing it through `wrapTrpcError` marks it retriable, the
   executor re-runs the whole mutation-fn, **re-issues the tRPC write**, and times
   out again forever. This is not hypothetical — it is how the original pilot
   jammed. The guard is the "mutate called exactly once" assertion; it looks
   redundant next to the "doesn't throw" test and is not.
2. **A timeout is swallowed, never thrown.** Past the tRPC call the server has
   committed; throwing rolls back a write that succeeded.
3. **It needs a live shape to carry the txid.** `messages` is `IDLE_GC_MS` and GC
   aborts the stream — safe here because GC only fires with no mounted live query,
   sending only happens from the channel screen where one is mounted, and the 60s
   tier dwarfs `awaitTxId`'s 5s default. Re-check if either constant moves.

### 13.4 What this does and does not buy

**Does:** the bubble survives the reconciliation window. Any stall shorter than 5s
is now invisible instead of fatal.

**Does not:** survive a real stall. After the 5s timeout the row still drops and
the message still disappears. This converts an unbounded, silent,
indistinguishable-from-data-loss failure into a bounded one — it is not a
persistent outbox UI.

Making the message visibly persist as "sending…" means surfacing the pending
transaction in `MessageList`, which is a genuinely separate piece of work. Worth
doing, but it should not be smuggled in here.

Verification: mobile 38/38, web 112/112 (6 new), both typechecks clean. No import
cycle introduced — `collections/communication` reaches neither app's
`infrastructure/offline`.

---

## 14. Shape `where` order stability (§10.6), fixed

`resolveMemberScope` now sorts its three id arrays before returning them.

The arrays are interpolated **positionally** by `idSetWhere` into
`col = ANY(ARRAY['a','b',…])`, and that string is the Electric shape's identity —
`shape-where.ts` says so itself: *"a changed string is a new Electric shape, a new
handle, and a full refetch for every client."* But the two `SELECT`s behind them
carry no `ORDER BY`, and Postgres guarantees nothing there. A plan flip to an index
scan, an autovacuum relocating tuples, or an `UPDATE` rewriting a row to a new page
reorders them, and every connected client refetches messages, tasks, resources and
properties at once.

Not an authorization bug — the *set* is identical either way, so the same rows are
authorized. It is a thundering-herd refetch triggered by something as mundane as
vacuum, and essentially unattributable after the fact.

**The mobile client already did this** (`collections/init.ts` — `uniqSorted` at 127,
`[...new Set(…)].sort()` at 220) for the ids it puts in the shape URL. The server
was the missing half of the same invariant, which is decent evidence this was an
oversight rather than a decision.

`tests/unit/access-scope-order.test.ts` (4 tests) feeds identical rows back in
different orders and asserts the output does not move, covering the
membership/owned-channel union as well as the simple case. Verified to FAIL without
the sort — its two ordering tests break while the de-dup and empty-scope tests keep
passing, which is the discrimination that makes it worth having.

Web 116/116, typecheck clean.

---

## 15. Instrumentation removed (2026-07-22)

With §11.4b confirming the fix deliberately, all four diagnostics are out:

| Removed | Was |
|---|---|
| `infrastructure/offline/wake-probe.ts` (deleted) + its call in `app/_layout.tsx` | `[wake]` AppState transitions and the JS-timer gap |
| `infrastructure/auth/cookie-fetch.ts` | `[net#N]` request/in-flight counter |
| `messages/components/MessageList.tsx` | `[msg-diag]` ENTER/LEAVE effect |
| `messages/components/MessageInput.tsx` | `[msg-diag]` send log |

All were `__DEV__`-gated, so this changes no production behaviour — it removes log
noise and, in `cookie-fetch`, a wrapper around every request on the sync hot path.

**Everything they were watching is still watchable**, which is why removing them is
safe: a stalled shape shows up as `GET /api/<x>` no longer cycling in any network
trace, and a vanished message shows up as the bubble vanishing. The instrumentation
made those things *precise*, not *visible*.

If any of it is ever needed again, `git show <this-commit>^:<path>` has each file
intact; `wake-probe.ts` in particular is worth recovering wholesale rather than
rewriting, because its constants are a deliberate mirror of
`@electric-sql/client`'s private `#subscribeToWakeDetection` (`INTERVAL_MS = 2000`,
`WAKE_THRESHOLD_MS = 4000`) and a drift there makes the probe lie.

What stays, and is NOT diagnostic:
- `infrastructure/polyfills/abort-signal-reason.ts` — the fix itself.
- `[shape-retry]` in `makeShapeRetry` — pre-existing, and the only outward sign a
  shape is stuck retrying.
- `[collections]` / `[layout]` / `[SQLite]` boot lines — pre-existing lifecycle logs.

Verification: mobile 38/38, web 116/116, both typechecks clean, lint clean on every
touched file.
