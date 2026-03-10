# React Native Mobile App Roadmap — BuildInLime

## Context

BuildInLime is a project management tool for natural builders with a hierarchical structure:
**Projects → Build Units → Channels → Tasks / Messages / Resources**

The mobile app is a **companion to the web app** (v4), sharing the same backend:
- Same PostgreSQL database
- Same tRPC API for writes
- Same Electric SQL sync for real-time reads
- Same Better Auth for authentication

The mobile app is a **smart reader and intent sender** — it reads synced state from Electric SQL
and sends write intents through tRPC. Business logic and access control live in the backend.

> See `whenIsDDDaOverKill.md` for why full DDD is not applied to the mobile client.

---

## Architecture Principles

### What the Mobile App Owns
- UI state (loading, selected project, open drawers/sheets)
- Optimistic updates (mark task complete before server confirms)
- Navigation logic (deep links, back stack)
- Device-native capabilities (camera, push notifications, offline cache)

### What Lives in the Backend
- Validation rules (tRPC routers + Zod)
- Access control (auth middleware)
- Business rules (unique names, assignment constraints)
- State transition authority (tRPC as write path, Electric as sync)

### Write Path
```
Mobile client → tRPC mutation → Postgres → Electric SQL → all clients
```

### Scoped Sync Strategy
Electric collections are activated **lazily per selected project**:
- **Before project selection**: only `projectsCollection` is active
- **After project selection**: `buildUnitsCollection`, `channelsCollection`,
  `tasksCollection`, `messagesCollection`, `resourcesCollection`, `propertiesCollection`
  are activated — all filtered to the selected project via `?project_id=` query param
- Selected project ID is persisted in `expo-secure-store` so it survives app restarts
- Backend proxy routes accept optional `project_id` filter to scope Electric shapes

---

## Tech Stack

| Concern | Web (v4) | Mobile |
|---|---|---|
| Framework | TanStack Start (SSR) | Expo (managed workflow) |
| Navigation | TanStack Router (file-based) | Expo Router + React Navigation Drawer |
| Styling | Tailwind CSS | NativeWind v4 (same design tokens) |
| Real-time sync | Electric SQL + TanStack DB | Electric SQL (RN client) + TanStack DB |
| Auth | Better Auth (email OTP) | Better Auth client + expo-secure-store |
| API | tRPC (SSR) | tRPC vanilla client |
| File upload | fetch FormData | expo-document-picker + expo-image-picker |
| Local store | IndexedDB | expo-sqlite |
| Push notifications | — | Expo Notifications |
| Session storage | HTTP cookies (browser) | expo-secure-store (manual cookie jar) |

---

## Navigation Structure

### Top-Level Flow
```
Login → Project Selection → [Project Home] ← Left Drawer (always accessible)
                                  ↓
                          Build Units Grid (2-col)
                                  ↓
                    Build Unit Detail (Channels Grid + Build Unit Properties)
                                  ↓
                    Channel Screen (Properties + Messages/Comments)
```

### Left Drawer
Accessible via hamburger icon from any authenticated screen.

| Item | Screen | Description |
|---|---|---|
| Home | Project Selection | Shows project list, tap to switch projects |
| My Tasks | My Tasks | All tasks assigned to current user |
| Inbox | Inbox | @mentions feed |
| Profile | Profile | User info + sign out |

### Expo Router File Structure
```
app/
├── _layout.tsx                          # Root: auth guard
├── (auth)/
│   ├── _layout.tsx
│   └── login.tsx
└── (app)/                               # All authenticated screens
    ├── _layout.tsx                      # Drawer navigator
    ├── index.tsx                        # Home — project selection
    ├── my-tasks.tsx                     # My Tasks
    ├── inbox.tsx                        # Inbox
    ├── profile.tsx                      # Profile + sign out
    └── project/
        └── [projectId]/
            ├── _layout.tsx              # Stack for project navigation
            ├── index.tsx                # Build units grid
            └── [buildUnitId]/
                ├── index.tsx            # Channels grid + build unit properties
                └── [channelId].tsx      # Channel (properties + messages)
```

---

## Folder Structure

```
BuildInLimeMobile/
├── app/                                  # Expo Router routes (thin shells)
│   ├── _layout.tsx
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx
│   └── (app)/
│       ├── _layout.tsx                   # Drawer layout
│       ├── index.tsx                     # Project selection
│       ├── my-tasks.tsx
│       ├── inbox.tsx
│       ├── profile.tsx
│       └── project/[projectId]/
│           ├── _layout.tsx
│           ├── index.tsx
│           └── [buildUnitId]/
│               ├── index.tsx
│               └── [channelId].tsx
│
├── src/
│   ├── infrastructure/
│   │   ├── auth/
│   │   │   ├── client.ts
│   │   │   └── cookie-fetch.ts
│   │   └── trpc/
│   │       └── client.ts
│   │
│   ├── application/
│   │   ├── collections/
│   │   │   ├── projects.ts              # Always-active projects collection
│   │   │   └── scoped.ts                # Factory: createProjectCollections(projectId)
│   │   ├── context/
│   │   │   └── ProjectContext.tsx       # Selected project state + scoped collections
│   │   └── hooks/
│   │       └── use-pending-uploads.ts
│   │
│   └── presentation/
│       ├── projects/
│       │   ├── components/
│       │   │   └── ProjectCard.tsx
│       │   └── hooks/
│       │       └── useProjects.ts
│       ├── build-units/
│       │   ├── components/
│       │   │   ├── BuildUnitCard.tsx
│       │   │   └── BuildUnitsGrid.tsx
│       │   └── hooks/
│       │       └── useBuildUnits.ts
│       ├── channels/
│       │   ├── components/
│       │   │   ├── ChannelCard.tsx
│       │   │   └── ChannelsGrid.tsx
│       │   └── hooks/
│       │       └── useChannels.ts
│       ├── messages/
│       │   ├── components/
│       │   │   ├── MessageList.tsx
│       │   │   ├── MessageBubble.tsx
│       │   │   └── MessageInput.tsx
│       │   └── hooks/
│       │       └── useMessages.ts
│       ├── tasks/
│       │   ├── components/
│       │   │   ├── TaskCard.tsx
│       │   │   └── TaskDetail.tsx
│       │   └── hooks/
│       │       └── useTasks.ts
│       ├── properties/
│       │   ├── components/
│       │   │   ├── PropertyPill.tsx
│       │   │   └── PropertyEditorSheet.tsx
│       │   └── hooks/
│       │       └── useProperties.ts
│       ├── resources/
│       │   ├── components/
│       │   │   └── ResourceAttachment.tsx
│       │   └── hooks/
│       │       └── useFileUpload.ts
│       └── shared/
│           ├── colors.ts
│           └── components/
│               ├── ErrorBanner.tsx
│               ├── LoadingSpinner.tsx
│               └── Avatar.tsx
│
├── assets/
├── app.json
├── global.css
└── tailwind.config.js
```

---

## Feature Parity Map

| Web Feature | Mobile Priority | Notes |
|---|---|---|
| Email OTP login | P0 ✅ Done | |
| Project selection screen | P0 | Cards centred, tap to select |
| Scoped Electric sync | P0 | Only selected project's data syncs |
| Build units grid (2-col) | P0 | |
| Channels grid + build unit props | P0 | |
| Channel (messages + properties) | P0 | |
| Left drawer navigation | P0 | Home, My Tasks, Inbox, Profile |
| My Tasks list | P1 | Grouped by status, swipe-to-complete |
| Task detail | P1 | Bottom sheet |
| Inbox (@mentions) | P1 | Notification badge |
| File attachments (view) | P1 | expo-sharing |
| File upload | P1 | Camera + picker |
| Properties editor | P1 | Bottom sheet per type |
| Push notifications | P1 | Mobile-only |
| Offline read | P2 | Electric SQLite store |
| Create project/channel/build unit | P2 | |
| Offline message queue | P2 | |
| Polish + release | P3 | |

---

## Phase Breakdown

### Phase 0 — Project Setup ✅ Done

### Phase 1 — Authentication ✅ Done
Email OTP, session persistence, auth guard, profile screen.

**Key files:**
- `src/infrastructure/auth/cookie-fetch.ts`
- `src/infrastructure/auth/client.ts`
- `app/(auth)/login.tsx`

---

### Phase 2 — Design System + Electric Collections ✅ Done
BuildInLime design tokens in NativeWind, Electric collections wired up.

**Key files:**
- `tailwind.config.js` — design tokens
- `src/presentation/shared/colors.ts`
- `src/application/collections/organization.ts`
- `src/application/collections/communication.ts`
- `src/application/collections/admin.ts`

---

### Phase 3 — Navigation Restructure + Project Selection
**Goal:** Left drawer shell + project selection screen with scoped sync.

#### 3a — Navigation restructure
- Install `@react-navigation/drawer`, `react-native-gesture-handler`
- Rename `app/(tabs)/` → `app/(app)/`
- `app/(app)/_layout.tsx` — Drawer navigator with 4 items:
  Home, My Tasks, Inbox, Profile
- Custom drawer content component styled with BuildInLime tokens
- `app/(app)/project/[projectId]/_layout.tsx` — Stack pushed on top of drawer

#### 3b — Project selection screen
- `app/(app)/index.tsx` — project list centred on screen
- `src/presentation/projects/components/ProjectCard.tsx` — card with project name, tap to navigate
- `src/application/collections/projects.ts` — always-active projects collection
  (only this collection runs before a project is selected)
- On tap → `router.push('/project/${id}')` + save selected project ID to SecureStore

#### 3c — Scoped sync
- `src/application/collections/scoped.ts` — `createProjectCollections(projectId)` factory
  returns buildUnits, channels, tasks, messages, resources, properties collections
  all filtered via `?project_id=${projectId}` query param
- `src/application/context/ProjectContext.tsx` — holds selected project ID,
  activates scoped collections, exposes via `useProjectContext()`
- Backend change: proxy routes (`/api/buildunits`, `/api/channels`, etc.)
  accept optional `project_id` query param to scope the Electric shape `where` clause

**Verification:**
- App loads → only projects collection syncs (check network tab)
- Select project → scoped collections activate
- Switch projects → old collections stop, new ones start

---

### Phase 4 — Build Units Grid
**Goal:** Grid of build unit cards after selecting a project.

- `app/(app)/project/[projectId]/index.tsx` — thin shell
- `src/presentation/build-units/components/BuildUnitCard.tsx`
  - Project name in header
  - Card: build unit name, description, property pills (status, priority)
- `src/presentation/build-units/components/BuildUnitsGrid.tsx`
  - 2-column FlatList (`numColumns={2}`)
  - Pull-to-refresh
- `src/presentation/build-units/hooks/useBuildUnits.ts`
  — reads from `buildUnitsCollection` filtered by `projectId`

---

### Phase 5 — Channels Grid + Build Unit Properties
**Goal:** Tap a build unit → see channels grid + build unit properties.

- `app/(app)/project/[projectId]/[buildUnitId]/index.tsx` — thin shell
- `src/presentation/channels/components/ChannelCard.tsx`
  - Channel name + type icon (copy `channelIcons.ts` mapping from web)
- `src/presentation/channels/components/ChannelsGrid.tsx`
  - 2-column FlatList
- `src/presentation/properties/components/PropertyPill.tsx`
  - Status, Priority, Target Date pills
- Build unit properties displayed as horizontal pill row above the channels grid

---

### Phase 6 — Channel Screen (Properties + Messages)
**Goal:** Tap a channel → see properties + messages/comments.

- `app/(app)/project/[projectId]/[buildUnitId]/[channelId].tsx` — thin shell
- `src/presentation/messages/components/MessageList.tsx`
  — inverted FlatList, newest at bottom
- `src/presentation/messages/components/MessageBubble.tsx`
  — sender initial avatar, name, time, text
- `src/presentation/messages/components/MessageInput.tsx`
  — sticky input bar, `KeyboardAvoidingView`
- `src/presentation/properties/components/PropertyPill.tsx` — reused
- Channel properties shown as pill row in collapsible header above messages

---

### Phase 7 — My Tasks
- `app/(app)/my-tasks.tsx` — tasks assigned to current user, grouped by status
- Swipe-to-complete gesture
- Task detail bottom sheet

---

### Phase 8 — Inbox
- `app/(app)/inbox.tsx` — messages where `mention_ids` contains current user
- Breadcrumb: Project > Build Unit > Channel
- Badge count on drawer item

---

### Phase 9 — File Attachments
View and upload files from mobile.

---

### Phase 10 — Properties Editor
Bottom sheet editor for all property types.

---

### Phase 11 — Push Notifications
Backend changes required (push_token column, notify on mention/assign).

---

### Phase 12 — Offline Support
Electric SQL + expo-sqlite for offline reads.

---

### Phase 13 — Polish + Release
App icons, dark mode, accessibility, EAS Build.

---

## Execution Order

| Phase | Feature | Status | Priority |
|-------|---------|--------|----------|
| 0 | Project setup | ✅ Done | P0 |
| 1 | Email OTP auth | ✅ Done | P0 |
| 2 | Design system + Electric collections | ✅ Done | P0 |
| 3 | Drawer nav + project selection + scoped sync | Next | P0 |
| 4 | Build units grid | — | P0 |
| 5 | Channels grid + build unit properties | — | P0 |
| 6 | Channel screen (properties + messages) | — | P0 |
| 7 | My Tasks | — | P1 |
| 8 | Inbox | — | P1 |
| 9 | File attachments | — | P1 |
| 10 | Properties editor | — | P1 |
| 11 | Push notifications | — | P1 |
| 12 | Offline support | — | P2 |
| 13 | Polish + release | — | P3 |

---

## Backend Changes Required

| Change | Phase |
|---|---|
| `trustedOrigins` includes `http://10.0.2.2:3000` | ✅ Done (Phase 1) |
| Proxy routes accept optional `project_id` query param | Phase 3c |
| `users.push_token` column + push on mention/assign | Phase 11 |

---

## Key Differences from Web App

| Aspect | Web | Mobile |
|---|---|---|
| Navigation | File-based routes, URL bar | Left drawer + stack |
| Project entry point | Projects list page | Project selection screen (centred cards) |
| Sync scope | All user data | Scoped to selected project |
| Build units | Table view | 2-column grid |
| Channels | List in sidebar | 2-column grid |
| Properties UI | Side panel / popover | Bottom sheet |
| File upload | Drag-and-drop | Camera + native picker |
| Notifications | None | Push (Expo) |
| Auth session | HTTP cookies | expo-secure-store |
| CSRF Origin | Browser sends automatically | Injected manually |
