# Shape Concurrency & Lazy Sync Guide (Mobile + Web)

## Overview

Both apps keep one Electric long-poll open per synced collection, permanently.
Every HTTP client caps how many concurrent requests it will run to one host. When
live shapes outnumber those slots, everything else — **including mutations** —
queues behind them. That single sentence is the whole guide.

The cap differs by platform, and so does the fix:

| | Live shapes | Cap | Status |
|---|---|---|---|
| **Mobile (Android)** | 10 | OkHttp `maxRequestsPerHost` = 5 (**calls**) | **Fixed** — cap raised to 32 (§1) |
| **Mobile (iOS)** | 10 | `NSURLSession` ~4 (**calls**) | **Not done** (§5) |
| **Web** | 11 | Browser 6 per origin (**connections**) | **Not biting** — HTTP/2 via Caddy (§3) |

The mobile/web asymmetry is the crux and the easiest thing to get wrong:
**HTTP/2 fixes the web but NOT mobile.** The browser limit is on *connections*, so
h2 multiplexing dissolves it. OkHttp's limit is on *calls*, so h2 changes nothing.
Electric's docs only describe the browser case — following them on mobile sends
you down the wrong path.

Sections:

1. The mobile connection-cap bug (fixed) — background and evidence
2. **The outstanding work item**: lazy, screen-scoped shapes (deferred until the
   mobile UI screens are crystallised)
3. The web app: why it's safe today, and the `:3000` trap
4. How to verify any change to sync concurrency
5. iOS (not yet done)

Investigated 2026-07-11/12. Related: `tanstackdb_electric_guide.md`,
`mobileAppSetupTroubleshoot.md`.

---

## 1. Background: the connection-cap bug (FIXED)

### Symptom

A message sent from mobile took ~20s to appear on other devices (e.g. the web
app). The mobile UI itself painted instantly (optimistic insert), so the write
looked sent — it just didn't reach Postgres for ~20s. Inbound sync on every
collection was also running at roughly half its intended freshness.

### Root cause

The app starts **10 Electric collections** concurrently in
`mobile-app/src/application/collections/init.ts` (memberships, projects, users,
buildunits, channels, teams, tasks, messages, resources, properties). Each holds
an Electric **live long-poll** — a request the server parks for ~20s at a time.
At steady state, all 10 are permanently in flight.

React Native on Android routes `fetch` through OkHttp, whose `Dispatcher`
defaults to **`maxRequestsPerHost = 5`**. So five long-polls occupied every
available slot and everything else queued — including the tRPC mutation POST
from `messages.create`. The POST was released only when a long-poll returned.

**The cap counts calls, not connections, so HTTP/2 does NOT lift it.** Electric's
documented fix for this in browsers (multiplex over h2 via a Caddy proxy — which
is why `web-app/code/Caddyfile` exists) does **not** carry over to React Native.

### Evidence that isolated it

Diagnostic instrumentation in `cookie-fetch.ts` logged each `/api` request with
an in-flight count and elapsed time. The signature:

- Shape long-polls took **~40s** each (39.7–40.1s, very uniform).
- One outlier returned at **20058ms**.
- 20s = Electric's real long-poll timeout. So ~40s = 20s *queued* + 20s polling,
  and the 20s outlier was the one shape that got a slot immediately. Two
  populations = a fixed-size slot pool with more pollers than slots.

Both alternative suspects were ruled out by direct measurement:

- **Electric**: 9 concurrent live long-polls straight at the container → all
  returned in exactly 20s.
- **The Node proxy** (`electric-proxy.ts`): same 9 through an identical
  `fetch`-based proxy → again all 20s.

The server answers 9+ concurrent long-polls in 20s every time. The extra ~20s was
added on the device.

### The fix

`mobile-app/android/app/src/main/java/com/anonymous/BuildInLimeMobile/MainApplication.kt`
registers an `OkHttpClientFactory` with `maxRequestsPerHost = 32` /
`maxRequests = 64`, installed **before `loadReactNative()`** (NetworkingModule
memoizes its client on first use, so a factory registered later is ignored).

The factory builds from `OkHttpClientProvider.createClientBuilder(context)`, not
the bare no-arg builder — setting a factory bypasses
`OkHttpClientProvider.createClient(context)`, and the context-aware builder is
what installs RN's default 10MB HTTP response cache. Using the bare builder
would silently drop that cache.

**After the fix**: long-polls settle at ~20s, `messages.create` returns in
milliseconds.

### Gotcha that cost an hour

`MainApplication.kt` is Kotlin — it only reaches the device through a native
build. `expo start` + a Metro reload will hot-swap JS while **silently running
the old native code**, so the fix appeared not to work. The project has no
`expo-dev-client` and every `package.json` script is a plain `expo start`, so
nothing in the normal workflow rebuilds native.

Any change under `android/` needs:

```sh
cd mobile-app/android && ./gradlew :app:installDebug   # or: npx expo run:android
```

Verify what's actually on the device:

```sh
adb shell dumpsys package com.anonymous.BuildInLimeMobile | grep lastUpdateTime
```

If `lastUpdateTime` predates your edit, you are testing stale native code.

### Why the cap is 5 (and why raising it is safe)

Straight from OkHttp's maintainers ([square/okhttp#4404](https://github.com/square/okhttp/issues/4404)):

> "Historical decision plus inertia." — swankjesse (OkHttp lead)

It is **not** a device-resource guard. It echoes the HTTP/1.1-era browser
convention (spec suggested 2 connections per host; browsers settled on 6; OkHttp
picked 5). In [#4354](https://github.com/square/okhttp/issues/4354) the same
maintainer puts a socket at *"about ~64 KiB… memory is cheap"*, and another notes
the assumption behind the default: *"I doubt an android app would really require
more than 5 simultaneous connections anywhere."* That assumption predates sync
engines that park one long-poll per collection.

Measured on device after raising the cap to 32: **3–4 OkHttp threads, ~61 total
threads**, memory dominated by the ~209MB native heap. The sockets are noise.

### But the fix is not free — which is why section 2 exists

- **Request rate roughly doubled.** Each shape now cycles every ~20s instead of
  ~40s. Same 10 shapes, twice the cycles → more radio wakeups → battery. (You
  never "saved" anything before; you paid for it in staleness.)
- **Each parked long-poll costs the server a held-open connection.** 10 per
  device × every concurrent user. This scales linearly with users and is the
  thing that will actually bite.

Raising the cap removed an artificial ceiling. It did not make 10 permanently-live
shapes a good idea. Electric's own guidance:

> "Reduce the number of concurrent shape subscriptions by lazy-loading shapes
> only when needed (e.g. per screen) rather than subscribing to all shapes on app
> boot." — https://electric.ax/docs/guides/troubleshooting

---

## 2. The outstanding work: lazy, screen-scoped shapes

### 🛑 Blocker: a stopped shape currently cannot be restarted

**Do not build the registry until this is fixed.** A refcounted registry exists to
*stop and start* shapes on demand — and today, inbound sync **never re-arms after an
abort**. Observed on device 2026-07-13: all ten shapes aborted at once and not one
reconnected; the app kept writing (tRPC 200s) while receiving nothing back, until a
restart. See §7 of `mobileUiAndShapeBudget.md` for the full write-up.

The mechanism is documented in the `NEVER_GC` comment in
`src/application/collections/_shared.ts`: sync is started imperatively once via
`startSyncImmediate()` and never restarted. Disabling GC removed the *GC* trigger for
that abort; it did not remove the failure mode — any abort (backgrounded app, dropped
socket, cancelled long-poll) opens the same one-way door.

Building a stop/start registry on a sync layer that cannot start a stopped shape is
building on the bug. Fix the restart path first, then the registry's "restart the same
instance rather than rebuilding it" hazard below becomes meaningful rather than moot.

### Prerequisite

**Crystallise the mobile UI screens first.** Which collections are screen-scoped
is a direct function of which screens exist and what each renders. The analysis
below is accurate as of 2026-07-12 — **re-derive it before implementing**, using
the commands in "How to re-derive the map".

### Current shape map (as of 2026-07-12)

| Collection | Read by | Verdict |
|---|---|---|
| `memberships` | scope source of truth, resync detection | always-on |
| `projects` | project picker / nav | always-on |
| `buildunits` | nav, build-unit screen | always-on (while project open) |
| `channels` | nav, channel list | always-on (while project open) |
| `messages` | `inbox.tsx` (all channels) + channel screen | always-on — see below |
| `tasks` | `my-tasks.tsx` (whole project) + channel screen | always-on — see below |
| `resources` | channel screen only (`MessageList`, `ResourcesSection`) | **screen-scoped** |
| `properties` | channel screen + build-unit screen | **screen-scoped** |
| `users` | **nothing** — zero live queries | **dead weight** |
| `teams` | **nothing** in UI; only written via `actions/teams.ts` | **dead weight** |

**`messages` and `tasks` cannot be made per-screen.** `inbox.tsx` reads messages
across every channel (mentions) and `my-tasks.tsx` reads tasks across the whole
project. Both are *tabs* — one press away at all times. Scoping messages to the
open channel breaks the inbox. Narrowing them properly means giving inbox and
my-tasks their own narrow server-side shapes (e.g. a mentions-for-me shape),
which is a real architectural change — don't attempt it until server-side
connection pressure justifies it.

Realistic steady state: **10 → 6 shapes** (8 while a channel screen is open).

### Step 1 — Drop the dead weight (small, do this first)

`usersCollection` and `teamsCollection` are never read by any live query.
`users` is started in `initBootstrapCollections()` with zero readers; `teams` is
only written. Stop syncing them (or sync on demand). No new machinery required,
no UX change, 10 → 8.

Caveat: `actions/teams.ts` inserts optimistically into `teamsCollection`, so the
collection object must still exist and be registered with the offline executor —
it just doesn't need a live shape. See "Writes to a stopped collection" below.

### Step 2 — Refcounted shape registry

Keep `NEVER_GC`. Drive start/stop **explicitly** instead:

- `acquireShape(key)` / `releaseShape(key)` with refcounts.
- A `useShapeSync(key)` hook: acquire on mount, release on unmount **after a
  grace period (~60s)** so tab-flipping doesn't churn shapes.
- Channel and build-unit screens call it for `resources` / `properties`.
  Everything else stays always-on.

### Why this is safe now (and why GC wasn't)

`src/application/collections/_shared.ts` says a GC'd collection "goes permanently
silent." That's what *happened*, but it is not a library limitation. In TanStack
DB's lifecycle state machine, **`cleaned-up → loading` is an explicitly legal
transition**, and `sync.startSync()` accepts a status of either `idle` or
`cleaned-up` (`@tanstack/db/dist/esm/collection/lifecycle.js`, `sync.js`).

The old bug was that **nothing ever called `startSync` again**: sync is started
imperatively once via `startSyncImmediate()`, GC tore it down, and no code path
brought it back. A refcounted registry is safe precisely because every teardown
has a matching, deliberate restart — GC decided *for* you, invisibly.

### Hazards to handle explicitly

**Restart the same instance — do not rebuild it.** The offline executor captures
collection instances *by value* at `startOfflineExecutor()`
(`infrastructure/offline/executor.ts`). Rebuilding an instance leaves the executor
holding a stale reference — the same hazard already worked around on project
switch via `resetAllOfflineActions()` + `initOfflineExecutor()`. Shape URLs don't
change on navigation, so a stopped collection can be restarted **in place**
(`cleanup()` → `startSyncImmediate()`), sidestepping the executor rebind entirely.

**`resources` is not persisted.** Unlike tasks/messages/properties it has no
`persistedCollectionOptions`, so a stop/start is a full shape refetch rather than
a SQLite rehydrate. Either add persistence or lean on the grace period.

**Writes to a stopped collection.** `actions/teams.ts` inserts optimistically into
a collection that may not be live. The sync layer *appears* to self-start on that
path (`sync.js` restarts when status is `idle`/`cleaned-up`) — **verify this, do
not assume it.** Otherwise, actions must acquire the shape before mutating.

**The resync path rebuilds instances.** `resyncProjectCollections()` in `init.ts`
recreates collections when membership scope changes. The registry must stay
coherent with that — a rebuilt collection needs its refcount and sync state
carried over.

### How to re-derive the map (do this after the UI is settled)

```sh
cd mobile-app
# Which screens read which collections:
grep -rln "tasksCollection\|messagesCollection\|resourcesCollection\|\
propertiesCollection\|teamsCollection\|usersCollection\|buildUnitsCollection\|\
channelsCollection" app src/presentation

# Dead-weight check — a collection with no hits outside collections/ and
# actions/ is not rendered anywhere:
grep -rn "usersCollection" app src | grep -v "collections/admin.ts"
```

A collection is **screen-scoped** if every reader lives under a single route
subtree. It is **always-on** if any tab-level screen reads it.

---

## 3. The web app

### The same ingredients are present

The web app starts **11 Electric shapes** (`buildunits`, `channel-members`,
`channels`, `memberships`, `messages`, `projects`, `properties`, `resources`,
`tasks`, `teams`, `users`), all with `gcTime: NEVER_GC`, so like mobile they stay
live for the whole session. Browsers cap HTTP/1.1 at **6 connections per origin**.
Eleven shapes, six slots — structurally the same bug as mobile.

### Why it isn't biting (today)

Shape URLs are built from `window.location.origin`
(`src/application/collections/_shared.ts`), so **which URL you browse decides
whether you hit the bug.** Verified 2026-07-12:

```
https://localhost:5173  -> HTTP 2      (Caddy — vite-plugin-caddy.ts)
http://localhost:3000   -> HTTP 1.1    (Vite direct)
```

Over HTTP/2 all 11 shapes multiplex as *streams* on one TCP connection (browsers
allow ~100), so the 6-connection limit never engages. `caddyPlugin()` in
`vite.config.ts` auto-starts Caddy in front of Vite, and that is what's saving
the web app. This is exactly Electric's recommended fix — and on the web it
genuinely works, because the browser's limit is on connections.

### THE TRAP: `:3000` vs `:5173`

`pnpm dev` runs `vite dev --port 3000` and **Vite prints `http://localhost:3000`
to the terminal — that URL serves HTTP/1.1.** Browse the app there instead of
`https://localhost:5173` and you get the full mobile bug: 11 shapes, 6 slots,
mutations queued behind long-polls, the same ~40s/~20s long-poll signature.

**The port the tooling advertises is the broken one.** The working origin is only
implied by the Caddy plugin. If the web app is ever "mysteriously slow / stale",
check the origin first.

It also degrades with tabs: browsers share the 6-connection pool per origin
*across tabs*, so on HTTP/1.1 two tabs = 22 shapes fighting over 6 connections.
Under HTTP/2 that's just more streams on the coalesced connection and stays fine.

**Quick check:** DevTools → Network → enable the **Protocol** column. `/api/*`
requests must read `h2`. If they read `http/1.1`, you are on the wrong origin.

### Production requirement

There is no deployment config in the repo yet (no Dockerfile / `fly.toml` /
`vercel.json`), so this is forward-looking — but it is a hard requirement:

> **The production edge MUST serve HTTP/2 (or h3) to the browser.**

Most hosts and CDNs do by default. But if the app ends up behind an HTTP/1.1-only
proxy or load balancer, this bug returns **for every user at once**, and it will
present as "the app is slow and stale", not as anything that points at connection
limits. Note that the browser's 6-connection cap applies to the *origin the page
is served from*, so a same-origin `/api/*` path (what this app uses) shares the
page's pool.

### Lazy shapes apply here too

HTTP/2 raises the ceiling; it does not reduce the load. Eleven permanently-parked
long-polls per tab still cost the **server** a held-open connection each,
multiplied by every user and every tab. Section 2's lazy-shape work applies to the
web app as well — on web it is a scaling concern rather than a correctness one.

Note the web shape map differs from mobile's: the persistent `<Sidebar>` keeps
`projects`/`buildUnits`/`channels`/`users`/`teams` subscribed, so `users` and
`teams` are **not** dead weight on web the way they are on mobile. Re-derive the
map per app; do not copy mobile's conclusions across.

---

## 4. Verifying any change to sync concurrency

Temporary instrumentation in `cookie-fetch.ts` (marked `TEMP DEBUG`) logs every
`/api` request with an in-flight count, elapsed time, and a `[net] SLOW` dump of
everything outstanding when a non-live request exceeds 1s. If it has been
stripped, reinstate it from git history (see commit `af58a5e` and follow-ups).

**Healthy signature:**

- Shape long-polls settle at **~20s** (Electric's long-poll timeout).
- `POST /api/trpc/*` returns in **tens of milliseconds**.
- **No `[net] SLOW` blocks.**

**Queue-starvation signature:**

- Long-polls at **~2× the long-poll timeout** (queued + polling).
- Mutations taking seconds, completing right as a shape poll returns.

To check the server side independently (rules out Electric and the proxy), open
N concurrent live long-polls directly against Electric on `localhost:30000` and
time them — all should return in ~20s regardless of N.

---

## 5. iOS (not yet done)

iOS has the same class of cap via `NSURLSession`
(`HTTPMaximumConnectionsPerHost`, default 4 on iOS — worse than Android's 5).
The override point is `RCTHTTPRequestHandler.mm`, not `OkHttpClientProvider`.
React Native offers no JS-level knob:
[react-native-community/discussions-and-proposals#166](https://github.com/react-native-community/discussions-and-proposals/issues/166)
asked for one and was **closed**.

Confirm how RN 0.83 configures `RCTHTTPRequestHandler` before touching it. Note
that lazy shapes (section 2) reduce the pressure on iOS regardless, which is
another reason to prefer that work over chasing a native override on each
platform.

---

## References

- Electric — too many shapes / connection limits: https://electric.ax/docs/guides/troubleshooting
- OkHttp `maxRequestsPerHost`: https://square.github.io/okhttp/5.x/okhttp/okhttp3/-dispatcher/max-requests-per-host.html
- OkHttp defaults rationale: https://github.com/square/okhttp/issues/4404
- RN configurable connection limits (closed): https://github.com/react-native-community/discussions-and-proposals/issues/166
