---
name: collectionsLoadDesign
description: This skill should be used when the user asks to "add a new authenticated route with preloads", "fix blank flash during navigation", "add a loading state to a route", "preload a collection for a new page", or any task that involves Electric collection preloading, pendingComponent setup, or undefined guards in BuildInLime authenticated routes.
version: 1.0.0
---

# Electric Collections Load Design (Option D)

This skill documents the canonical preload + pending UI pattern for BuildInLime authenticated routes. It was established to eliminate:
- Repeated preloads of shared collections across routes
- Silent blank-screen navigation (no `pendingComponent`)
- Inconsistent `?? []` fallbacks that mask undefined vs empty

---

## Architecture Overview

### Tier 1 — Layout-level shared preload (`_authenticated.tsx`)

The `_authenticated` layout route preloads the 4 collections used by every page. These run once and are reused across all child routes.

```ts
// src/presentation/routes/_authenticated.tsx
loader: async () => {
  await Promise.all([
    projectsCollection.preload(),
    buildUnitsCollection.preload(),
    usersCollection.preload(),
    teamsCollection.preload(),
  ])
},
```

**Never add these 4 to per-route loaders.** They are already available when any child route mounts.

### Tier 2 — Per-route loaders (route-specific collections only)

Each route loader preloads only collections that are NOT covered by the layout. These are collections whose data is scoped to a specific context (channel, task, etc.) or that are expensive enough to defer until needed.

| Route | Collections to preload in loader |
|---|---|
| `projects/index.tsx` | *(none — loader removed)* |
| `$projectId/index.tsx` | *(none — loader removed)* |
| `$buildUnitName/index.tsx` | `channelsCollection`, `propertiesCollection` |
| `$channelName/index.tsx` | `channelsCollection`, `propertiesCollection`, `tasksCollection`, `resourcesCollection`, `messagesCollection` |
| `$taskName.tsx` | `channelsCollection`, `tasksCollection`, `propertiesCollection`, `resourcesCollection` |
| `my-tasks.tsx` | `tasksCollection`, `channelsCollection` |
| `inbox.tsx` | `messagesCollection`, `channelsCollection` |

### Tier 3 — `RoutePendingComponent` (navigation loading UI)

A shared component shown while a route's loader is running. It renders `<Sidebar />` (which can use layout-preloaded data immediately) plus a "Loading…" placeholder in the content area.

```tsx
// src/presentation/components/buildInlime/RoutePendingComponent.tsx
import { Sidebar } from "./Sidebar"

export function RoutePendingComponent() {
  return (
    <div className="flex h-screen bg-white font-['Instrument_Sans',sans-serif]">
      <Sidebar />
      <div className="flex-1 flex items-center justify-center text-[#717182]">
        Loading…
      </div>
    </div>
  )
}
```

---

## Adding a New Authenticated Route

When adding a new page under `/_authenticated/`, follow this checklist:

### 1. Determine which collections to preload

- Shared (projects, buildUnits, users, teams) → **do not** add to loader; layout covers them
- Page-specific → add to a `loader` in the route file

### 2. Route file template

```ts
import { createFileRoute } from '@tanstack/react-router'
import { RoutePendingComponent } from '<relative-path>/components/buildInlime/RoutePendingComponent'
import { fooCollection, barCollection } from '%/infrastructure/database/tanstack-db-electric/admincollections'
import { FooPage } from '<relative-path>/pages/FooPage'

export const Route = createFileRoute('/_authenticated/foo')({
  component: FooPage,
  loader: async () => {
    await Promise.all([
      fooCollection.preload(),
      barCollection.preload(),
    ])
  },
  pendingComponent: RoutePendingComponent,
})
```

If no page-specific collections are needed, omit `loader` entirely.

### 3. Relative import depth for `RoutePendingComponent`

| Route location | Import path prefix |
|---|---|
| `routes/_authenticated/` | `../../components/buildInlime/RoutePendingComponent` |
| `routes/_authenticated/projects/` | `../../../components/buildInlime/RoutePendingComponent` |
| `routes/_authenticated/projects/$projectId/` | `../../../../components/buildInlime/RoutePendingComponent` |
| `routes/_authenticated/projects/$projectId/$buildUnitName/` | `../../../../../components/buildInlime/RoutePendingComponent` |
| `routes/_authenticated/projects/$projectId/$buildUnitName/$channelName/` | `../../../../../../components/buildInlime/RoutePendingComponent` |

---

## Undefined Guards in Component Code

### Rule

Use `=== undefined` (loading state) not `?? []` (masks loading as empty). The two states have different UX meaning:
- `undefined` → data not yet synced → show "Loading…"
- `[]` → data synced, genuinely empty → show empty state

### Pattern

```tsx
// Before — wrong: masks loading as empty
const items = data ?? []

// After — correct: distinguish loading from empty
if (data === undefined) return <LoadingIndicator />
const items = data
```

### Where to apply

- In page components that use `useLiveQuery` results directly (e.g. `ChannelPage.tsx`)
- In route components for chained ID lookups (`dbBuildUnits`, `dbChannels`, `dbTasks`)
- Do NOT apply to derived values computed from already-guarded data

### Existing guard pattern in route components

```tsx
// Chain of guards for deeply nested routes
if (dbBuildUnits === undefined) {
  return <div className="flex h-screen items-center justify-center text-[#717182]">Loading…</div>
}
if (!buildUnit) {
  return <div className="flex h-screen items-center justify-center text-[#717182]">Build unit "{buildUnitName}" not found.</div>
}
if (dbChannels === undefined) {
  return <div className="flex h-screen items-center justify-center text-[#717182]">Loading…</div>
}
if (!channel) {
  return <div className="flex h-screen items-center justify-center text-[#717182]">Channel "{channelName}" not found.</div>
}
```

All hooks must be called before any guards (React rules of hooks).

---

## Verification Checklist

When implementing or auditing routes:

- [ ] Layout-level 4 collections are NOT repeated in per-route loaders
- [ ] All authenticated routes have `pendingComponent: RoutePendingComponent`
- [ ] No `?? []` on `useLiveQuery` results that could be `undefined` — use `=== undefined` guard instead
- [ ] `teamsCollection` is NOT preloaded per-route (layout covers it; Sidebar uses it)
- [ ] Route-specific collections are preloaded in the route's own `loader`
- [ ] Empty state (0 items) and loading state (undefined) render different UI

---

## Key Files

| File | Purpose |
|---|---|
| `src/presentation/routes/_authenticated.tsx` | Layout loader — shared preloads + auth check |
| `src/presentation/components/buildInlime/RoutePendingComponent.tsx` | Shared pending UI component |
| `src/infrastructure/database/tanstack-db-electric/admincollections.ts` | All Electric collection definitions |
