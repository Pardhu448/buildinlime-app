---
name: addNewPageRoute
description: This skill should be used when the user asks to "add a new page", "add a new route", "create a new route", "add a page route", or any task that involves creating a new TanStack Router route + page component in BuildInLime.
version: 1.0.0
---

# Add New Page Route

This skill covers the full pattern for adding a new page route to the BuildInLime app. The router uses **TanStack Router file-based routing** under `src/presentation/routes/`.

---

## Route File Hierarchy

All routes live under `src/presentation/routes/`. The tree currently is:

```
routes/
├── __root.tsx                         ← root layout
├── index.tsx                          ← redirect to /projects
├── login.tsx                          ← unauthenticated page
├── api/auth/$.ts                      ← better-auth API handler
├── _authenticated.tsx                 ← layout guard (checks session)
└── _authenticated/
    └── projects/
        ├── index.tsx                  ← /projects list page
        ├── $projectId.tsx             ← layout (Outlet only)
        └── $projectId/
            ├── index.tsx              ← /projects/$projectId
            ├── $buildUnitName.tsx     ← layout (Outlet only)
            └── $buildUnitName/
                ├── index.tsx          ← /projects/$projectId/$buildUnitName
                ├── $channelName.tsx   ← layout (Outlet only)
                └── $channelName/
                    ├── index.tsx      ← /projects/$projectId/$buildUnitName/$channelName
                    └── $taskName.tsx  ← /projects/$projectId/$buildUnitName/$channelName/$taskName
```

---

## Two Kinds of Route Files

### 1. Layout route (parent with children)
Used when a segment has child routes nested under it. File contains only `<Outlet />`.

```tsx
// $segmentName.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/projects/$projectId/$segmentName')({
  component: () => <Outlet />,
})
```

### 2. Leaf / index route (renders a page)
Used for the actual page component. If it's the default child of a layout, use `index.tsx` with a trailing `/` in the route string.

```tsx
// $segmentName/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { MyPage } from '../../../../../pages/MyPage'  // adjust depth

export const Route = createFileRoute('/_authenticated/projects/$projectId/$segmentName/')({
  component: MyRoute,
  loader: async () => {
    await Promise.all([/* preload collections */])
  },
})

function MyRoute() {
  const { projectId, segmentName } = Route.useParams()
  // useLiveQuery calls here
  return <MyPage ... />
}
```

---

## Adding a New Nested Page — Step-by-Step

### Step 1: Is the parent segment already a layout route?

- If `$parentName.tsx` renders `<Outlet />` → already a layout, skip to step 2.
- If `$parentName.tsx` renders a page component → convert it to an `<Outlet />` layout, move its content to `$parentName/index.tsx`, update the route string to add a trailing `/`.

### Step 2: Create the new route file

For a **leaf route** at depth N, create `$newSegment.tsx` (or `index.tsx`) inside the matching directory.

### Step 3: Create the page component

Page components live in `src/presentation/pages/`. They are plain React components — no router logic. They receive all data as props from the route component.

```tsx
// src/presentation/pages/MyPage.tsx
export function MyPage({ projectId, foo }: { projectId: string; foo: string }) {
  return <div>...</div>
}
```

### Step 4: Wire data in the route component

The route component (in `routes/`) is responsible for:
- Calling `Route.useParams()` to get URL params
- Running `useLiveQuery` calls for live data
- Passing shaped data as props to the page component

---

## Relative Import Depth Reference

Route files import pages via relative paths. Count `../` by how many directory levels are between the route file and `src/presentation/`:

| Route file location | Levels to `src/presentation/` | Import prefix |
|---|---|---|
| `routes/` | 1 | `../pages/` |
| `routes/_authenticated/` | 2 | `../../pages/` |
| `routes/_authenticated/projects/` | 3 | `../../../pages/` |
| `routes/_authenticated/projects/$projectId/` | 4 | `../../../../pages/` |
| `routes/_authenticated/projects/$projectId/$buildUnitName/` | 5 | `../../../../../pages/` |
| `routes/_authenticated/projects/$projectId/$buildUnitName/$channelName/` | 6 | `../../../../../../pages/` |

---

## Route String Rules

- **Layout route** (file `$seg.tsx`): route string = `'/_authenticated/.../seg'` — **no trailing slash**
- **Index route** (file `$seg/index.tsx`): route string = `'/_authenticated/.../seg/'` — **trailing slash required**
- **Named leaf** (file `$seg/$child.tsx`): route string = `'/_authenticated/.../seg/$child'` — no trailing slash

---

## Data Fetching Pattern

### Preloading in the loader

All ElectricSQL collections used by the route must be preloaded in the `loader`:

```tsx
loader: async () => {
  await Promise.all([
    fooCollection.preload(),
    barCollection.preload(),
  ])
},
```

### useLiveQuery calls

Always import from `@tanstack/react-db`:

```tsx
import { useLiveQuery, eq } from "@tanstack/react-db"

const { data: dbItems } = useLiveQuery(
  (q) => q.from({ fooCollection }).where(({ fooCollection: f }) => eq(f.some_id, someId)),
  [someId]
)
```

### JSONB column unwrapping

ElectricSQL returns `jsonb` columns as JSON-encoded strings (e.g. `'"status"'`). Always unwrap before use:

```tsx
const unwrapJsonb = (v: unknown) =>
  typeof v === 'string' && v.startsWith('"') ? JSON.parse(v) : v
```

Also handle snake_case fallback for camelCase DB columns:
```tsx
const raw = p as unknown as Record<string, unknown>
type: unwrapJsonb(p.type ?? raw['type']) as Property['type'],
```

---

## Navigation

### Link component (declarative)
```tsx
import { Link } from "@tanstack/react-router"
<Link to="/projects/$projectId/$buildUnitName" params={{ projectId, buildUnitName }}>...</Link>
```

### useNavigate (imperative, e.g. on click)
```tsx
import { useNavigate } from "@tanstack/react-router"
const navigate = useNavigate()
navigate({
  to: '/projects/$projectId/$buildUnitName/$channelName/$taskName',
  params: { projectId, buildUnitName, channelName, taskName: task.name },
})
```

---

## Troubleshooting

### "Ghost page" — blank page for non-existent dynamic segment

**Symptom:** Navigating to a URL with a fake/invalid `$buildUnitName`, `$channelName`, or `$taskName` renders a blank page instead of an error.

**Root cause:** `useLiveQuery` returns `undefined` while Electric SQL is syncing, then `[]` or `[...items]` once data arrives. The common pattern `(dbItems ?? []).find(...)` silently produces `undefined` when the entity doesn't exist, and derived IDs fall back to `''`. No error is shown.

**Fix:** After all `useLiveQuery` calls, add existence guards:

```tsx
// 1. Still syncing
if (dbBuildUnits === undefined) {
  return <div className="flex h-screen items-center justify-center text-[#717182]">Loading…</div>
}

// 2. Synced, but entity not found
const buildUnit = dbBuildUnits.find((bu) => bu.name === buildUnitName)
if (!buildUnit) {
  return (
    <div className="flex h-screen items-center justify-center text-[#717182]">
      Build unit "{buildUnitName}" not found.
    </div>
  )
}
```

Apply a guard for each dynamic segment in the chain (buildUnit → channel → task).

**Critical: never call hooks after an early return.** All `useLiveQuery` calls must come before any guard. For downstream queries that depend on an ID (e.g. channels filtered by `buildUnitId`), keep using the `?? ''` fallback for the dep while hooks are still at the top — the guard that follows will prevent rendering with stale/empty data.

```tsx
// CORRECT — all hooks first, guards after
const { data: dbBuildUnits } = useLiveQuery(...)
const buildUnit = (dbBuildUnits ?? []).find(...)
const buildUnitId = buildUnit?.id ?? ''          // '' until buildUnit exists

const { data: dbChannels } = useLiveQuery(       // still called unconditionally
  (q) => q.from({ channelsCollection }).where(...eq(..., buildUnitId)),
  [buildUnitId]
)

// Guards come after ALL hooks
if (dbBuildUnits === undefined) return <Loading />
if (!buildUnit) return <NotFound />
if (dbChannels === undefined) return <Loading />
...
```

---

## Checklist When Adding a New Route

- [ ] Parent segment has a layout file (`<Outlet />`) if children exist
- [ ] Route string matches file path and uses trailing `/` for index routes only
- [ ] `loader` preloads all collections used
- [ ] Page component in `src/presentation/pages/` accepts all data as props (no router imports)
- [ ] Relative import depth is correct (count `../` levels to `src/presentation/`)
- [ ] JSONB columns are unwrapped before use
- [ ] Navigation uses typed `params` object, not string interpolation
