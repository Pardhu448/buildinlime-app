# Web App Troubleshoot Guide

## Overview

This guide documents common issues and solutions when developing the web app, particularly around the Vite dev server, TanStack Router, and HMR.

---

## Issue 1: "Duplicate declaration `hot`" on HMR

### Symptom

When editing any route file while the dev server is running, the console floods with:

```
[vite] Internal server error: Duplicate declaration "hot"
[vite] (client) Pre-transform error: Duplicate declaration "hot"
```

The error originates from `@tanstack/router-plugin`'s code-splitter (`compilers.js`). A fresh server start works fine, but any file save triggers the error.

### Root Cause

The `tanstackStart()` plugin from `@tanstack/react-start` **already includes** the TanStack Router code-splitter internally (via `tanStackRouterCodeSplitter`). If `TanStackRouterVite()` from `@tanstack/router-plugin/vite` is also registered in `vite.config.ts`, the code-splitter runs **twice** on every route file.

Each pass injects a `const hot = import.meta.hot` HMR statement. On re-transform during HMR, Babel sees two `hot` declarations in the same scope and throws.

### Fix

Remove the standalone `TanStackRouterVite()` plugin and move its config into `tanstackStart()`:

```ts
// BEFORE (broken) — two plugins both run the code-splitter
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

plugins: [
  TanStackRouterVite({
    routesDirectory: './src/presentation/routes',
    generatedRouteTree: './src/presentation/routeTree.gen.ts',
  }),
  tanstackStart({
    srcDirectory: 'src/presentation',
  }),
]

// AFTER (fixed) — single plugin handles everything
plugins: [
  tanstackStart({
    srcDirectory: 'src/presentation',
    router: {
      routesDirectory: './routes',            // relative to srcDirectory
      generatedRouteTree: './src/presentation/routeTree.gen.ts',
    },
  }),
]
```

**Note:** `routesDirectory` inside `tanstackStart().router` is resolved relative to `srcDirectory`, so use `./routes` not `./src/presentation/routes` (otherwise the path doubles up).

### How to verify

1. Start the dev server (`pnpm dev`)
2. Edit and save any route file under `src/presentation/routes/`
3. Confirm the HMR update applies without "Duplicate declaration `hot`" errors

---

## Issue 2: Stale `.tanstack/tmp/` cache files

### Symptom

The dev server crashes or shows unexpected errors on startup. Untracked `.tanstack/tmp/` files appear in `git status`.

### Root Cause

The TanStack Router code-splitter writes intermediate split files to `.tanstack/tmp/` during dev. These are regenerated each time the server starts but are not always cleaned up on exit.

### Fix

1. Delete the cache: `rm -rf .tanstack/`
2. Restart the dev server

These files are already in `.gitignore` so they won't pollute version control.

---

## Issue 3: Stale `vite.config.timestamp_*.js` files

### Symptom

A file like `vite.config.timestamp_1775884282388.js` appears in the project root and in `git status`.

### Root Cause

Vite creates temporary timestamped config files during dev. They are not always cleaned up.

### Fix

Delete the file: `rm vite.config.timestamp_*.js`

This pattern is already in `.gitignore`.
