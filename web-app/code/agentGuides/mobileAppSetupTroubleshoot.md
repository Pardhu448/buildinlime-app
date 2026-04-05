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

## Environment Variable Reference

`mobile-app/.env`:

```env
EXPO_PUBLIC_API_URL=http://<your-laptop-lan-ip>:3000
```

Update `<your-laptop-lan-ip>` to your current Wi-Fi IP each time it changes (DHCP reassignment). Check current IP with:

```bash
ip addr show | grep 'inet ' | grep -v '127.0.0.1'
```
