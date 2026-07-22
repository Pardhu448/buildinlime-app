# React Native Mobile App — Implementation Plan
## BuildInLime Companion App

---

## Current State

| Phase | Status | Summary |
|-------|--------|---------|
| Phase 0 — Project Setup | ✅ Done | Expo app, NativeWind, tRPC, Better Auth wired up |
| Phase 1 — Authentication | ✅ Done | Email OTP, SecureStore cookie jar, auth guard, profile screen, CSRF fix |
| Phase 2 — Design System + Electric Collections | ✅ Done | BuildInLime tokens in NativeWind, Electric collections created |
| Phase 3 — Navigation + Project Selection + Scoped Sync | 🔄 In Progress | Drawer nav, project selection screen, scoped Electric collections |

---

## Architecture Overview

### Navigation Structure
```
Login Screen
    ↓ (on success)
Project Selection Screen  ←── Left Drawer (hamburger)
    ↓ (tap project)              ├── Home (Project Selection)
Build Units Grid                 ├── My Tasks
    ↓ (tap build unit)           ├── Inbox
Channels Grid + Build Unit Props └── Profile
    ↓ (tap channel)
Channel Screen (Properties + Messages)
```

### Scoped Sync Strategy
- **Before project selection**: only `projectsCollection` is active
- **After project selection**: scoped collections activate for that project only
- Collection URLs include `?project_id=xxx` — backend proxy scopes Electric shape accordingly
- Selected project ID persisted in `expo-secure-store` — survives app restarts
- Collection instances are cached per `projectId` — no re-creation on re-renders

### Write Path
```
Mobile client → tRPC mutation → Postgres → Electric SQL → all clients
```

### Key Files
```
src/
  infrastructure/
    auth/
      client.ts              ← Better Auth client + cookie fetch
      cookie-fetch.ts        ← SecureStore cookie jar (manual browser equivalent)
    trpc/
      client.ts              ← tRPC vanilla client using cookie fetch
  application/
    collections/
      projects.ts            ← Always-active projects collection
      scoped.ts              ← createScopedCollections(projectId) factory
    context/
      ProjectContext.tsx     ← Selected project state + scoped collection access
  presentation/
    shared/
      colors.ts              ← Raw hex values for imperative APIs
    projects/
      components/ProjectCard.tsx
      hooks/useProjects.ts
    build-units/
      components/BuildUnitCard.tsx
      components/BuildUnitsGrid.tsx
      hooks/useBuildUnits.ts
    channels/
      components/ChannelCard.tsx
      components/ChannelsGrid.tsx
      hooks/useChannels.ts
    messages/
      components/MessageList.tsx
      components/MessageBubble.tsx
      components/MessageInput.tsx
      hooks/useMessages.ts
    tasks/
      components/TaskCard.tsx
      hooks/useTasks.ts
    properties/
      components/PropertyPill.tsx
    shared/
      components/DrawerContent.tsx

app/
  _layout.tsx                ← Root layout: auth guard + ProjectProvider
  (auth)/
    _layout.tsx
    login.tsx
  (tabs)/                    ← Group name doesn't matter to Expo Router
    _layout.tsx              ← Drawer navigator
    index.tsx                ← Project selection screen
    my-tasks.tsx
    inbox.tsx
    profile.tsx
    project/
      [projectId]/
        _layout.tsx          ← Stack for project navigation
        index.tsx            ← Build units grid
        [buildUnitId]/
          index.tsx          ← Channels grid + build unit properties
          [channelId].tsx    ← Channel screen (properties + messages)
```

---

## Phase 3 — Navigation + Project Selection + Scoped Sync

### 3a — Drawer Navigation

**Packages:**
```bash
npm install @react-navigation/drawer react-native-gesture-handler
```

**`app/(tabs)/_layout.tsx`** — Replace tab navigator with Drawer:
```tsx
import { Drawer } from "expo-router/drawer"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import DrawerContent from "@/src/presentation/shared/components/DrawerContent"

export default function AppLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer drawerContent={(props) => <DrawerContent {...props} />}
        screenOptions={{ headerShown: false, drawerType: "front" }}>
        <Drawer.Screen name="index" options={{ title: "Home" }} />
        <Drawer.Screen name="my-tasks" options={{ title: "My Tasks" }} />
        <Drawer.Screen name="inbox" options={{ title: "Inbox" }} />
        <Drawer.Screen name="profile" options={{ title: "Profile" }} />
        <Drawer.Screen name="project" options={{ drawerItemStyle: { display: "none" } }} />
      </Drawer>
    </GestureHandlerRootView>
  )
}
```

**`src/presentation/shared/components/DrawerContent.tsx`** — Custom drawer:
- BuildInLime logo mark at top
- Nav items: Home, My Tasks, Inbox, Profile
- Active item highlighted with `bg-primary/10 text-primary`
- Bottom: user name + email from `useSession()`
- Font: `InstrumentSans_500Medium`

### 3b — Project Selection Screen

**`app/(tabs)/index.tsx`** — Project selection:
- Title: "Select a Project" centred
- Projects listed as cards centred on screen
- Uses `projectsCollection` (always-active) via `useProjects()` hook
- On tap: `selectProject(id)` → navigate to `/project/${id}`
- Loading state while Electric syncs
- Empty state if no projects

**`src/presentation/projects/components/ProjectCard.tsx`**:
```
┌─────────────────────────────┐
│  [B]  Project Name          │
│       Description excerpt   │
└─────────────────────────────┘
```
- Primary-coloured initial avatar
- Subtle border, rounded-lg, shadow-sm
- Full width (centred column, not grid)

**`src/presentation/projects/hooks/useProjects.ts`**:
```ts
import { useCollection } from "@tanstack/react-db"
import { projectsCollection } from "../../application/collections/projects"

export function useProjects() {
  const { data, isLoading } = useCollection(projectsCollection, { select: (items) => [...items.values()] })
  return { projects: data ?? [], isLoading }
}
```

### 3c — Scoped Sync + Context

**`src/application/collections/scoped.ts`** — Factory:
- `createScopedCollections(projectId)` — creates 6 collections scoped to project
- Collection IDs: `build-units-${projectId}`, `channels-${projectId}`, etc.
- All URLs include `?project_id=${projectId}`
- Module-level cache: `Map<string, ScopedCollections>` — same instance on repeated calls

**`src/application/context/ProjectContext.tsx`** — Context:
- `projectId: string | null` — selected project
- `collections: ScopedCollections | null` — active scoped collections
- `selectProject(id)` — saves to SecureStore + activates collections
- `clearProject()` — deletes from SecureStore + nulls collections
- On mount: restores last project ID from SecureStore

**`app/_layout.tsx`** — Wrap with `<ProjectProvider>`:
```tsx
<ProjectProvider>
  <AuthGuard />
</ProjectProvider>
```

### 3d — Project Stack Routes

**`app/(tabs)/project/[projectId]/_layout.tsx`**:
```tsx
import { Stack } from "expo-router"
export default function ProjectLayout() {
  return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.background }, ... }} />
}
```

**`app/(tabs)/project/[projectId]/index.tsx`** — Build units placeholder (Phase 4)

---

## Phase 4 — Build Units Grid

### Route
`app/(tabs)/project/[projectId]/index.tsx`

### Screen Layout
```
┌─────────────────────────────┐
│ ← [Project Name]     [≡]   │  ← header with hamburger
├─────────────────────────────┤
│ ┌──────────┐ ┌──────────┐  │
│ │ Build    │ │ Build    │  │
│ │ Unit 1   │ │ Unit 2   │  │  ← 2-column grid
│ │ status●  │ │ status●  │  │
│ └──────────┘ └──────────┘  │
│ ┌──────────┐ ┌──────────┐  │
│ │ Build    │ │ Build    │  │
│ │ Unit 3   │ │ Unit 4   │  │
│ └──────────┘ └──────────┘  │
└─────────────────────────────┘
```

### Components

**`src/presentation/build-units/components/BuildUnitCard.tsx`**:
- Card with rounded-lg, border-border, bg-card
- Build unit name in `font-sans-semibold`
- Description in `text-muted-foreground text-xs` (1 line, ellipsis)
- Property pills row (status, priority) — uses `PropertyPill`
- Tap → navigate to `[buildUnitId]`

**`src/presentation/build-units/components/BuildUnitsGrid.tsx`**:
- `FlatList` with `numColumns={2}`, `columnWrapperStyle={{ gap: 12 }}`
- Pull-to-refresh
- Empty state: "No build units yet"

**`src/presentation/build-units/hooks/useBuildUnits.ts`**:
```ts
export function useBuildUnits(projectId: string) {
  const { collections } = useProjectContext()
  const { data } = useCollection(collections!.buildUnitsCollection, {
    select: (items) => [...items.values()].filter(b => b.project_id === projectId)
  })
  return { buildUnits: data ?? [] }
}
```

---

## Phase 5 — Channels Grid + Build Unit Properties

### Route
`app/(tabs)/project/[projectId]/[buildUnitId]/index.tsx`

### Screen Layout
```
┌─────────────────────────────┐
│ ← [Build Unit Name]   [≡]  │
├─────────────────────────────┤
│  ● In Progress  ↑ High      │  ← property pills (horizontal scroll)
│  📅 Mar 15                  │
├─────────────────────────────┤
│ ┌──────────┐ ┌──────────┐  │
│ │ 💬       │ │ ✅       │  │
│ │ General  │ │ Tasks    │  │  ← 2-column channel grid
│ └──────────┘ └──────────┘  │
│ ┌──────────┐ ┌──────────┐  │
│ │ 📋       │ │ 📁       │  │
│ │ Specs    │ │ Files    │  │
│ └──────────┘ └──────────┘  │
└─────────────────────────────┘
```

### Components

**`src/presentation/properties/components/PropertyPill.tsx`**:
- Status pill: coloured dot + label (e.g. `● In Progress`)
- Priority pill: arrow icon + label
- Date pill: calendar icon + formatted date
- Horizontal `ScrollView` wrapping the pill row

**`src/presentation/channels/components/ChannelCard.tsx`**:
- Icon (by channel name — copy `channelIcons` mapping from web)
- Channel name
- Tap → navigate to `[channelId]`

**`src/presentation/channels/components/ChannelsGrid.tsx`**:
- `FlatList` with `numColumns={2}`

**`src/presentation/channels/hooks/useChannels.ts`**:
```ts
export function useChannels(buildUnitId: string) {
  const { collections } = useProjectContext()
  const { data } = useCollection(collections!.channelsCollection, {
    select: (items) => [...items.values()].filter(c => c.buildunit_id === buildUnitId)
  })
  return { channels: data ?? [] }
}
```

---

## Phase 6 — Channel Screen (Properties + Messages)

### Route
`app/(tabs)/project/[projectId]/[buildUnitId]/[channelId].tsx`

### Screen Layout
```
┌─────────────────────────────┐
│ ← [Channel Name]      [≡]  │
├─────────────────────────────┤
│  ● Todo  ↑ Medium  📅 Apr  │  ← channel property pills (collapsible)
├─────────────────────────────┤
│                             │
│  [User A] 10:32am           │
│  Here is the update...      │
│                             │
│            [User B] 10:35am │
│       Got it, thanks!       │  ← inverted FlatList (newest at bottom)
│                             │
├─────────────────────────────┤
│ [Type a message...    ] [→] │  ← sticky input bar
└─────────────────────────────┘
```

### Components

**`src/presentation/messages/components/MessageList.tsx`**:
- Inverted `FlatList` (scroll up for history)
- Groups consecutive messages from same sender
- Pull-to-load-more (future)

**`src/presentation/messages/components/MessageBubble.tsx`**:
- Avatar initial circle (primary colour)
- Sender name + relative timestamp
- Message text
- Own messages right-aligned

**`src/presentation/messages/components/MessageInput.tsx`**:
- `KeyboardAvoidingView` wrapper
- TextInput + send button
- On send: `trpc.messages.create.mutate(...)`

**`src/presentation/messages/hooks/useMessages.ts`**:
```ts
export function useMessages(channelId: string) {
  const { collections } = useProjectContext()
  const { data } = useCollection(collections!.messagesCollection, {
    select: (items) => [...items.values()]
      .filter(m => m.channel_id === channelId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  })
  return { messages: data ?? [] }
}
```

---

## Phase 7 — My Tasks

### Route
`app/(tabs)/my-tasks.tsx`

### Screen Layout
```
┌─────────────────────────────┐
│ [≡] My Tasks                │
├─────────────────────────────┤
│ TODO                        │
│  ○ Fix foundation specs     │
│  ○ Update material list     │
├─────────────────────────────┤
│ IN PROGRESS                 │
│  ◑ Review channel comments  │
├─────────────────────────────┤
│ DONE                        │
│  ✓ Upload site photos       │
└─────────────────────────────┘
```

- Tasks from `tasksCollection` where `assignee_id === currentUser.id`
- Grouped by status (todo → in_progress → done)
- Swipe-to-complete gesture
- Tap → task detail bottom sheet

---

## Phase 8 — Inbox

### Route
`app/(tabs)/inbox.tsx`

- Messages where `mention_ids` contains current user ID
- Each item: sender avatar + name, message excerpt, breadcrumb
- Tap → navigate to that channel
- Badge count on drawer item

---

## Phase 9 — Properties Editor (Bottom Sheet)

- Tap a property pill → bottom sheet opens
- Status: segmented picker (Backlog / Todo / In Progress / Done / Cancelled)
- Priority: segmented picker (None / Low / Medium / High / Critical)
- Dates: `@react-native-community/datetimepicker`
- On save: `trpc.properties.update.mutate(...)`

---

## Phase 10 — File Attachments

**Viewing:**
- Tap resource → `expo-sharing` or `WebBrowser.openAsync`
- Image: thumbnail inline in message

**Uploading:**
- Attach button in `MessageInput`
- Action sheet: Camera / Photo Library / Files
- `expo-image-picker` + `expo-document-picker`
- Upload to `POST /api/resources/upload` via `FormData`
- Progress bar via `XMLHttpRequest`

---

## Phase 11 — Push Notifications

**Mobile:**
- `expo-notifications` + `expo-device`
- Request permission on first login
- Register Expo push token → save to `users.push_token` (backend migration needed)
- Deep link on notification tap → navigate to channel or task

**Backend changes (web codebase):**
```ts
// Add to users table migration
push_token: text("push_token")

// Add to messages.create tRPC router
await sendPushNotification(mentionedUser.push_token, "New mention", messageExcerpt)

// Add to tasks.create/update tRPC router
await sendPushNotification(assignee.push_token, "Task assigned", taskName)
```

---

## Phase 12 — Offline Support

- Electric SQL + `expo-sqlite` for offline reads (data cached locally)
- `@react-native-community/netinfo` for offline banner
- Message send queue in SQLite, flush on reconnect
- `expo-background-fetch` for background Electric sync

---

## Phase 13 — Polish + Release

- App icons + splash screen (BuildInLime branding)
- Dark mode (`dark:` NativeWind variants)
- Error boundaries + loading skeletons
- Haptic feedback (`expo-haptics`)
- Accessibility labels
- EAS Build for iOS + Android production
- App Store / Play Store submission
- EAS Update for OTA patches

---

## Backend Changes Summary

| Change | Phase | Status |
|--------|-------|--------|
| `trustedOrigins` includes `http://10.0.2.2:3000` | 1 | ✅ Done |
| `buildunits` proxy accepts optional `project_id` filter | 3 | ✅ Done |
| `channels` proxy accepts optional `project_id` filter | 3 | ✅ Done |
| `tasks` proxy accepts optional `project_id` filter | 3 | ✅ Done |
| `messages` proxy accepts optional `project_id` filter | 3 | ✅ Done |
| `resources` proxy accepts optional `project_id` filter | 3 | ✅ Done |
| `users.push_token` column + Drizzle migration | 11 | Pending |
| `messages.create` → notify mentioned users | 11 | Pending |
| `tasks.create/update` → notify assignee | 11 | Pending |

---

## Design System Rules

All components use NativeWind classes with BuildInLime tokens:

| Token | Value | Usage |
|-------|-------|-------|
| `bg-primary` | `#976623` | Buttons, active states, avatars |
| `text-primary` | `#976623` | Links, active tab labels |
| `bg-muted` | `#f5f5f5` | Input backgrounds, empty states |
| `text-muted-foreground` | `#717182` | Descriptions, timestamps |
| `border-border` | `#ac7f5e` | Card borders, dividers |
| `bg-destructive` | `#d4183d` | Sign out, delete actions |
| `font-sans` | `InstrumentSans_400Regular` | Body text |
| `font-sans-medium` | `InstrumentSans_500Medium` | Labels, buttons |
| `font-sans-semibold` | `InstrumentSans_600SemiBold` | Headings, screen titles |

Use `colors.ts` raw hex values only for imperative APIs (`tabBarActiveTintColor`, `ActivityIndicator color`, etc.).

---

## Key Conventions

1. **Route files are thin shells** — they import from `src/presentation/` and render one component
2. **Collections from context** — all scoped collections accessed via `useProjectContext().collections`
3. **Hooks filter client-side** — `useChannels(buildUnitId)` filters from the already-synced collection
4. **tRPC for writes** — all mutations go through tRPC, never write directly to collections
5. **Cookie fetch everywhere** — both tRPC client and Electric collections use `createCookieFetch()`
6. **Origin header injected** — prevents Better Auth CSRF 403 errors in React Native
