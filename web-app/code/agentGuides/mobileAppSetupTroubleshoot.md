# Mobile App Setup Troubleshoot Guide

## Overview

This guide documents common issues and solutions when setting up and running the Expo mobile app in this pnpm monorepo.

---

## Issue 1: Expo Go Shows "Failed to download remote update"

### Symptom

Expo Go on a physical device shows:

```
Uncaught Error: java.io.IOException: Failed to download remote update
```

### Root Cause

The Metro bundler fails to compile the JavaScript bundle. This error in Expo Go is misleading — the real error is in the Metro terminal output, not the network.

### Diagnosis

Check the Metro terminal for red error output, or open the bundle URL directly in a browser:

```
http://<your-laptop-ip>:8081/index.bundle?platform=android
```

---

## Issue 2: Metro Cannot Resolve `index` at Workspace Root

### Symptom

Metro terminal shows:

```
The module could not be resolved because none of these files exist:
  * /path/to/BuildInLime/index(.ts|.tsx|.js|...)
```

The path shown is the **monorepo workspace root**, not `mobile-app/`.

### Root Cause

`metro.config.js` had a broken `extraNodeModules` configuration:

```js
// BROKEN — these paths do not exist
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
}
```

In this pnpm monorepo, **all packages are hoisted to the workspace root's `node_modules/`**. The `mobile-app/node_modules/` directory only contains local workspace packages (`@buildinlime/*` and `@types`). The paths above resolve to `mobile-app/node_modules/react` and `mobile-app/node_modules/react-native`, neither of which exist.

When Metro tried to resolve `react` or `react-native` via `extraNodeModules`, it got a broken path. This corrupted the bundle resolution chain and ultimately surfaced as Metro failing to find the entry point (`index`) at the workspace root.

### Solution

Remove the broken `extraNodeModules` override. The custom `resolveRequest` already handles singleton resolution correctly by redirecting react/react-native lookups to the workspace root's `node_modules`:

```js
// metro.config.js — correct configuration
const SINGLETONS = ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-native"]

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (SINGLETONS.includes(moduleName) || moduleName.startsWith("react-native/")) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(workspaceRoot, "node_modules", "react", "package.json") },
      moduleName,
      platform
    )
  }
  return context.resolveRequest(context, moduleName, platform)
}
```

The `originModulePath` override points to the workspace root's `node_modules/react/`, ensuring Metro always resolves react and react-native from the single hoisted copy — preventing duplicate React instance crashes.

---

## Issue 3: Running Expo from the Wrong Directory

### Symptom

Running `npx expo start` from the **workspace root** instead of `mobile-app/` causes Metro to use the workspace root as the project root. Since there is no `metro.config.js` at the workspace root, Metro uses default config and fails to find the bundle entry point.

### Solution

Always start Metro from within `mobile-app/`, or use the workspace-root pnpm script which correctly scopes execution:

```bash
# From workspace root (recommended)
pnpm mobile:lan

# Or directly from mobile-app/
cd mobile-app && npx expo start --host lan --clear
```

The `pnpm mobile:lan` script uses `pnpm --filter buildinlimemobile` which changes the working directory to `mobile-app/` before running expo.

---

## Issue 4: Expo Go Cannot Connect Over LAN

### Checklist

| Check | How to verify |
|---|---|
| Same Wi-Fi network | Both devices on same SSID, not guest network |
| Firewall not blocking port 8081 | `sudo ufw status` — if active, `sudo ufw allow 8081` |
| Correct laptop IP in `.env` | Run `ip addr show` and compare with `EXPO_PUBLIC_API_URL` in `mobile-app/.env` |
| Metro advertising correct IP | Terminal should show `exp://<your-ip>:8081` |

### Starting Metro for LAN

```bash
pnpm mobile:lan
# expands to: pnpm --filter buildinlimemobile exec expo start --host lan --clear
```

Or from `mobile-app/`:

```bash
npx expo start --host lan --clear
```

### Fallback: Tunnel Mode

If LAN still doesn't work, use tunnel mode (routes through Expo servers):

```bash
cd mobile-app && npx expo start --tunnel
```

If the app loads via tunnel but not LAN, the problem is network/firewall related.

---

## Issue 4b: App Loads but API Calls Fail — USB Dev on a Client-Isolated Wi-Fi

### Symptom

The app **bundle loads and runs**, but every API/auth call fails with network errors. This is specifically a **physical device over USB** setup. Metro works, the API does not.

### Root Cause

There are **two dev servers**, and they can be reached over **different transports**:

| Server | Port | Transport |
|---|---|---|
| Metro bundler | 8081 | USB (`adb reverse tcp:8081`, set up by Expo) |
| Backend API | 3000 | whatever `EXPO_PUBLIC_API_URL` points at |

When `EXPO_PUBLIC_API_URL` points at the **LAN IP** but only Metro is reverse-forwarded over USB, the bundle rides the USB cable (works) while the API is expected over Wi-Fi. If the Wi-Fi router has **AP/client isolation** enabled (common on default and guest networks), the phone and laptop cannot reach each other **even on the same subnet** — so the API is unreachable. The tell-tale sign is that both `ping` and a TCP connect to `:3000` from the device time out despite matching `/24` addresses.

### Diagnosis

```bash
adb reverse --list                      # is tcp:3000 forwarded? (usually only 8081 is)
adb shell ip addr show wlan0            # device on Wi-Fi? same subnet as laptop?
adb shell ping -c 2 -W 1 <laptop-lan-ip>   # 100% packet loss => LAN path blocked
ss -tlnp | grep ':3000'                 # confirm API is listening on *:3000 (not just 127.0.0.1)
```

If the API listens on `*:3000` but the device can't ping/connect to the laptop's LAN IP, the LAN path is blocked (client isolation / firewall) — don't chase the server.

### Solution

Route the API over the **same USB cable** as Metro, bypassing the LAN entirely. Use the dedicated one-liner:

```bash
pnpm mobile:usb
```

This does all three required steps and can't clobber itself: pins `EXPO_PUBLIC_API_URL=http://localhost:3000` in `.env` (via `LAN_IP=localhost pnpm set-lan-ip`), sets up both USB forwards (`adb reverse tcp:8081` + `tcp:3000`), then starts Metro with `--clear` so the `localhost` value is re-inlined into the bundle (`EXPO_PUBLIC_*` vars are baked in at bundle time).

The equivalent manual steps, if you need them:

```bash
adb reverse tcp:8081 tcp:8081 && adb reverse tcp:3000 tcp:3000
# set EXPO_PUBLIC_API_URL=http://localhost:3000 in mobile-app/.env, then:
cd mobile-app && npx expo start --clear
```

`http://localhost:3000` is already in `trustedOrigins` (`server.ts`), so Better Auth accepts it — no `MOBILE_ORIGIN` edit needed for this path.

> **Footgun — do NOT use `pnpm mobile:lan` for USB dev.** Its `set-lan-ip` prestep **overwrites** `EXPO_PUBLIC_API_URL` in `.env` with the machine's LAN IP and bakes it into the fresh bundle — sending the API straight back to the client-isolated LAN. If your API calls fail right after starting Metro, check the active line in `mobile-app/.env`: if it flipped to a `192.168.x`/`10.x` IP, a `:lan` start script rewrote it. Use `pnpm mobile:usb` instead.

> **Note:** `adb reverse` entries are cleared when the device unplugs/re-plugs or the adb server restarts. `pnpm mobile:usb` re-adds them; if starting manually, re-run the `adb reverse` commands each session. If you instead want LAN mode, you must disable AP/client isolation on the router — same-subnet addresses alone are not enough.

---

## Issue 4c: Reads Work but Writes Fail After an `.env` Change (Stale tRPC Singleton)

### Symptom

After changing `EXPO_PUBLIC_API_URL` (e.g. LAN IP → `localhost` for USB), **Electric shape reads return `200`** but every **tRPC write fails**:

```
[fetch] 200 up-to-date /api/messages?…          ← reads fine
[fetch-error] /api/trpc/messages.create -> Network request failed   ← writes fail
```

Messages/tasks never persist, yet the app is clearly reaching the API for reads.

### Root Cause

`EXPO_PUBLIC_*` values are **inlined per-module at bundle time**, and the tRPC client is a **module-level singleton** that captures the URL once at init (`trpc/client.ts` → `const apiUrl = process.env.EXPO_PUBLIC_API_URL; httpBatchLink({ url: `${apiUrl}/api/trpc` })`).

A **Fast Refresh** after the `.env` change only re-evaluates changed modules and their importers. The auth client and Electric collection factories re-run (so reads switch to the new URL), but the tRPC client module does **not** — its singleton keeps the **old** URL (e.g. the dead LAN IP). Result: reads go to the new host and succeed; writes keep POSTing to the old host and fail with `Network request failed`.

### Diagnosis

The tell is **two different API URLs in one session** and reads/writes disagreeing. Attach to the Hermes console (see below) and look for the URL banners each singleton logs at init:

```
>>> AUTH API URL: http://localhost:3000        ← refreshed
>>> TRPC API URL: http://192.168.10.37:3000…   ← STALE  => writes fail
```

If `TRPC API URL` shows the old host while reads 200, the singleton is stale.

### Solution

**Do a full reload, not Fast Refresh** — press `r` in the Metro terminal, or cold-start the JS:

```bash
adb shell am force-stop com.anonymous.BuildInLimeMobile
# reopen the app
```

A cold JS start re-initializes every module-level singleton (tRPC client included) from the current bundle, so all of them agree on the URL. Verify with `>>> TRPC API URL: http://localhost:3000/api/trpc` followed by `[fetch] 200 … /api/trpc/messages.create`.

> **Rule of thumb:** any change to `EXPO_PUBLIC_*` requires a **full app reload**, because module-scope code that reads it at init won't pick up the new value via Fast Refresh alone.

### Reading the Hermes console when RN DevTools won't open

If RN DevTools fails to launch (on Linux it can crash with a Chrome `zygote_host` / `execvp` error) and, once a debugger is attached, console output stops printing in the Metro terminal, attach directly to the inspector's CDP endpoint to stream the console:

```bash
curl -s http://localhost:8081/json/list      # find the RN target's webSocketDebuggerUrl
# then connect a small ws client that sends Runtime.enable + Log.enable and prints
# Runtime.consoleAPICalled / Log.entryAdded / Runtime.exceptionThrown events.
```

This surfaces the same `console.log`/error/exception feed RN DevTools shows, including the URL banners above.

---

## Issue 5: Better Auth Rejects Mobile Requests (CSRF / Origin Error)

### Symptom

Mobile app receives `403` or auth errors despite the API being reachable. Server logs may show an origin rejection.

### Root Cause

Better Auth enforces a `trustedOrigins` allowlist for CSRF protection. When the laptop's LAN IP changes, the old IP entries in `server.ts` become stale, and requests from the mobile app's new origin are rejected.

### Solution

Update `web-app/code/src/infrastructure/auth/server.ts` — add both the HTTP API origin and the Expo dev client origin for the new IP:

```ts
trustedOrigins: [
  process.env.BETTER_AUTH_URL || "https://localhost:5173",
  "http://localhost:3000",
  "http://10.0.2.2:3000",
  "http://<your-laptop-lan-ip>:3000",   // mobile API calls
  "exp://<your-laptop-lan-ip>:8081",    // Expo dev client
  ...(process.env.MOBILE_ORIGIN ? [process.env.MOBILE_ORIGIN] : []),
],
```

Then restart the web server for the change to take effect.

> **Tip:** The `MOBILE_ORIGIN` env var provides a dynamic override — set it in the web app's `.env` to avoid editing `server.ts` each time the IP changes.

---

## Issue 6: Messages/Data Stop Syncing After a Few Minutes (Electric Collections Silently Die)

### Symptom

Everything works at first, then after a while the app stops receiving updates:

- A message sent from mobile reaches the server (the web app sees it) but never appears — or briefly flashes then vanishes — on mobile.
- Messages/tasks created on **another** client (e.g. the web app) never arrive on mobile.
- It looks like "optimistic updates are broken," but the real problem is that mobile stopped **receiving** data.
- A **sign-out + sign-in (or clearing the app's SQLite cache) temporarily fixes it**, then it recurs.

### Root Cause

**TanStack DB garbage-collects idle collections, and GC aborts the Electric shape's long-poll — which the app never restarts.**

1. `gcTime` defaults to **5 minutes** (`@tanstack/db` `lifecycle.js` → `this.config.gcTime ?? 3e5`).
2. When a collection has **zero active subscribers** (no mounted `useLiveQuery`), a 5-minute GC timer starts (`changes.js` → `startGCTimer`).
3. When it fires, sync is torn down and the Electric shape's in-flight fetch is **aborted** (`electric-db-collection` `electric.js` → `abortController.abort()`).
4. `electric-db-collection` **swallows the abort as intentional cleanup**, so it does **not** call the shape's `onError`/`retryOnError` — there is no retry and no reconnect.
5. The app starts sync imperatively **once** via `startSyncImmediate()` and never restarts it, so the collection is **dead for the rest of the session**: no inbound sync, and optimistic writes are dropped on commit with nothing to redeliver them.

Mobile is exposed because its drawer/leaf-screen navigation routinely leaves collections with **0 subscribers** (e.g. on a channel screen, the build-units/channels/projects/tasks collections have no mounted query). The **web app dodges this by accident** — a persistent `<Sidebar>` holds always-on `useLiveQuery` subscriptions to `projects`/`buildUnits`/`channels`/`users`/`teams`, so their subscriber count never hits 0 and GC never starts. Mobile has no such persistent subscriber.

> This compounds with a second, separate design choice: `mutation-fns.ts` deliberately **skips `awaitTxId`**, so a confirmed write's optimistic row is discarded on commit and relies on the Electric stream to redeliver it. If the stream is dead, that redelivery never happens — turning "harmless brief window" into "permanent disappearance." That reasoning is sound, but note it inherits the "dead for the session" premise questioned below, and `awaitTxId` would not have rescued it either: against a dead shape the txid never arrives, so the await times out and the optimistic row is dropped regardless. The cure for this symptom is keeping the shape alive, not the handshake. For why the handshake is skipped — and why the reason recorded for it was wrong — see ARCHITECTURE.md §12.6.

### Diagnosis

Temporarily log every shape request and any retry, then reproduce:

```ts
// src/infrastructure/auth/cookie-fetch.ts — log status of every /api/ request
// src/application/collections/_shared.ts — log inside retryOnError
```

The signature in the Metro logs is: healthy `[fetch] 200 up-to-date /api/messages?…` long-polls, then a burst of `-> Aborted` across several shapes, **zero `retryOnError` calls**, and afterwards those shapes never `[fetch]` again. Confirm the data is really missing on-device vs. present on the server:

```bash
# on-device store (debug build)
adb exec-out run-as com.anonymous.BuildInLimeMobile cat files/SQLite/buildinlime.sqlite > /tmp/m.sqlite
sqlite3 /tmp/m.sqlite "SELECT collection_id, table_name FROM collection_registry;"   # map messages -> c_xxxx
# compare row count vs Postgres truth
docker exec <postgres> psql -U postgres -d electric -c "SELECT count(*) FROM messages WHERE channel_id='<id>';"
```

If Postgres has newer rows than the device (and the Electric shape returns them on a manual resume from the device's stored offset), the shape is stalled client-side.

### Solution

> **⚠️ Partly superseded — read this first.** This section reflects the code as of 2026-07-09. The lazy-load work (2026-07-15) deliberately put `tasks`, `messages`, `resources` and `properties` back onto a finite `gcTime` (`IDLE_GC_MS`, 60s) precisely so their idle shapes DO close, and relies on a GC'd collection resurrecting when a live query subscribes again. Only the always-mounted spine and the badge slices are still `NEVER_GC`. So "`gcTime: Infinity` on **every** factory" below is no longer what the code does.
>
> The two rest on opposite premises about the same library version (`@tanstack/db` 0.6.5, unchanged since before either was written), and step 5 of the root cause above is the disputed one. `changes.ts → addSubscriber()` reads:
>
> ```js
> // Start sync if collection was cleaned up
> if (this.lifecycle.status === `cleaned-up` || this.lifecycle.status === `idle`) {
>   this.sync.startSync()
> }
> ```
>
> — i.e. the library *does* restart sync on resubscribe, which is the assumption the idle-GC design is built on. But this section documents a **reproduced** field failure with a clear diagnostic signature, and a source reading does not outrank that. The gap is most likely a collection that gets GC'd and is then read WITHOUT anything subscribing (resurrection is driven by `addSubscriber`, not by `startSyncImmediate` or a bare `.get()`).
>
> **Unresolved.** Re-run the verification below against the current two-tier GC before trusting either account. Until then, treat the steps here as the fallback if idle-GC'd collections are seen to stop syncing.

Disable GC on these session-scoped collections and tear them down explicitly instead:

1. **`gcTime: Infinity`** on every Electric collection factory (`organization.ts`, `communication.ts`, `admin.ts`). A non-finite `gcTime` makes `startGCTimer()` skip scheduling, so the sync never GC-aborts. See the shared `NEVER_GC` constant in `collections/_shared.ts`.
2. **Explicit `cleanup()` on teardown**, since GC no longer does it for us: call `.cleanup()` on the old instance before replacing it (project switch / membership resync) and in the `reset*Collections()` paths (sign-out), *before* `disposePersistence()` deletes the DB. See the shared `safeCleanup()` helper.

**Immediate unblock while debugging:** sign out and back in, or clear the sync DB, to force a fresh sync:

```bash
adb shell am force-stop com.anonymous.BuildInLimeMobile
adb exec-out run-as com.anonymous.BuildInLimeMobile sh -c 'rm -f files/SQLite/buildinlime.sqlite*'
# relaunch; keeps auth cookies (SecureStore) + outbox, re-syncs all shapes from scratch
```

**Verify the fix:** reload, sit on a screen **idle for >5 minutes**, then send from both web and mobile — messages should arrive live, with continuous `[fetch] up-to-date /api/messages` long-polls and no `Aborted`.

---

## Environment Variable Reference

`mobile-app/.env`:

```env
EXPO_PUBLIC_API_URL=http://<your-laptop-lan-ip>:3000
```

Update `<your-laptop-lan-ip>` to your current Wi-Fi IP each time it changes (DHCP reassignment). Check current IP with:

```bash
ip addr show | grep 'inet ' | grep -v '127.0.0.1'
```
