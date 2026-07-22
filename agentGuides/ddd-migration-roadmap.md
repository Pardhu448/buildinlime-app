# DDD Architecture Migration Roadmap — BuildInLime v4

## Context
The current codebase has 2 layers (`infrastructure/`, `presentation/`). The goal is to evolve it to a 4-layer DDD structure (`domain/`, `application/`, `infrastructure/`, `presentation/`) without breaking the running app at any step.

**Decisions confirmed:**
- Approach: phased, incremental — roadmap only for now
- `application/use-cases/` — **skipped** (tRPC routers already serve this role)
- Domain purity: **relaxed** — drizzle-zod schemas allowed in domain layer (no need to hand-write Zod schemas)

---

## Target Structure

```
src/
├── domain/
│   ├── admin/
│   │   └── types.ts            ← User, Team, Membership types + Zod schemas
│   ├── organization/
│   │   ├── types.ts            ← Project, BuildUnit, Channel types + CHANNEL_NAMES enum
│   │   └── validators.ts       ← Zod schemas (createProjectSchema etc.)
│   ├── communication/
│   │   ├── types.ts            ← Task, Message, Resource, Property types + enums
│   │   └── validators.ts       ← Zod schemas
│   └── shared/
│       └── types.ts            ← Common enums (PROPERTY_TYPES, STATUS_VALUES, PRIORITY_VALUES, ENTITY_TYPES)
│
├── application/
│   ├── collections/
│   │   ├── organization.ts     ← projectsCollection, buildUnitsCollection, channelsCollection, membershipsCollection
│   │   ├── communication.ts    ← tasksCollection, messagesCollection, resourcesCollection, propertiesCollection
│   │   └── admin.ts            ← usersCollection, teamsCollection
│   └── hooks/
│       ├── use-pending-resources.ts   (moved from presentation/hooks/)
│       └── pending-resources-db.ts    (moved from presentation/hooks/)
│
├── infrastructure/
│   ├── auth/                   (unchanged)
│   ├── database/
│   │   ├── schema/
│   │   │   ├── organization-tables.ts    ← projectsTable, buildUnitsTable, channelsTable, membershipsTable
│   │   │   ├── communication-tables.ts   ← tasksTable, messagesTable, resourcesTable, resourcesRawTable, propertiesTable
│   │   │   ├── admin-tables.ts           ← teamsTable
│   │   │   ├── auth-schema.ts            (unchanged)
│   │   │   └── admin-schema.ts           ← re-export barrel only (for backward compat during migration)
│   │   ├── tanstack-db-electric/
│   │   │   ├── admincollections.ts       ← re-export shim → application/collections/* (removed after migration)
│   │   │   └── authCollections.ts        (unchanged)
│   │   ├── connection.ts       (unchanged)
│   │   └── electric-proxy.ts   (unchanged)
│   ├── trpc/
│   │   ├── lib/trpc.ts         (unchanged)
│   │   ├── lib/trpc-client.ts  (unchanged)
│   │   └── routers/            ← all router files moved here (projects.ts, tasks.ts, etc.)
│   └── storage/
│       └── fileStorage.ts      ← file upload/download logic extracted from route handlers
│
└── presentation/
    ├── routes/                  (UNCHANGED — TanStack Router file-based routing)
    ├── pages/                   (unchanged)
    ├── components/
    │   ├── organization/        ← ProjectsTable, BuildUnitsTable, ChannelCard, ChannelHeader, etc.
    │   ├── communication/       ← CommentsSection, ResourcesSection, PropertiesPanel, TaskDetailContent, etc.
    │   ├── admin/               ← Sidebar, HeaderLoggedIn, TeamSection, etc.
    │   └── shared/
    │       ├── design-system/   (unchanged)
    │       └── ui/              (unchanged)
    ├── hooks/                   (emptied — content moved to application/hooks/)
    └── lib/                     (unchanged)
```

---

## Migration Phases

### Phase 0 — Create `domain/` Layer
**Risk: Zero** — additive only, no existing file is touched.

1. Create `src/domain/shared/types.ts`
   - Copy `CHANNEL_NAMES`, `PROPERTY_TYPES`, `ENTITY_TYPES`, `STATUS_VALUES`, `PRIORITY_VALUES` from `admin-schema.ts`

2. Create `src/domain/organization/types.ts`
   - Copy `Project`, `BuildUnit`, `Channel`, `Membership` TypeScript types
   - Copy their `selectXxxSchema` Zod schemas (drizzle-zod generated — keep as-is)

3. Create `src/domain/communication/types.ts`
   - Copy `Task`, `Message`, `Resource`, `Property` types and select schemas

4. Create `src/domain/admin/types.ts`
   - Copy `Team` type and user type alias

**What does NOT change:** `admin-schema.ts` still exports everything it currently does. All 29 existing importers continue to work. The domain files are a parallel island for now.

---

### Phase 1 — Move tRPC Routers to `routers/` Subfolder
**Risk: Low** — only one file imports them (`routes/api/trpc/$.ts`).

1. Create `src/infrastructure/trpc/routers/`
2. Move all flat router files into `routers/`:
   - `trpc/projects.ts` → `trpc/routers/projects.ts`
   - (same for buildunits, channels, tasks, messages, resources, properties, users, teams, todos)
3. Update internal imports: `../database/schema/admin-schema` → `../../database/schema/admin-schema`
4. Update the one consumer: `routes/api/trpc/$.ts` — change 10 import paths from `%/infrastructure/trpc/X` to `%/infrastructure/trpc/routers/X`

**Verification:** App boots, all CRUD mutations work.

---

### Phase 2 — Split `admin-schema.ts` Internals + Extract `fileStorage.ts`
**Risk: Medium for 2a, Low for 2b**

#### 2a — Split schema into table files
1. Create `infrastructure/database/schema/organization-tables.ts`
   - Move `projectsTable`, `buildUnitsTable`, `channelsTable`, `membershipsTable` (+ their Zod schemas and TS types)
2. Create `infrastructure/database/schema/communication-tables.ts`
   - Move `tasksTable`, `messagesTable`, `resourcesTable`, `resourcesRawTable`, `propertiesTable`
3. Create `infrastructure/database/schema/admin-tables.ts`
   - Move `teamsTable`
4. Convert `admin-schema.ts` into a **re-export barrel**:
   ```ts
   export * from "./auth-schema"
   export * from "./organization-tables"
   export * from "./communication-tables"
   export * from "./admin-tables"
   ```
   All 29 importers continue to work unchanged.

#### 2b — Extract `fileStorage.ts`
1. Create `infrastructure/storage/fileStorage.ts`
   - Extract file-write logic from `routes/api/resources/upload.ts`
   - Extract file-read logic from `routes/api/resources/$resourceId/file.ts`
2. Route files become thin wrappers: `import { handleUpload } from '%/infrastructure/storage/fileStorage'`

**Verification:** File uploads and downloads still work.

---

### Phase 3 — Create `application/collections/` (The Hardest Step)
**Risk: High** — `admincollections.ts` is imported by ~21 files.

**Strategy: split + re-export shim, then migrate importers one at a time**

1. Create the three new collection files:
   - `application/collections/organization.ts`
   - `application/collections/communication.ts`
   - `application/collections/admin.ts`
   - Each imports types from `%/domain/...` and tRPC client from `%/infrastructure/trpc/lib/trpc-client`

2. Convert `admincollections.ts` to a **re-export shim**:
   ```ts
   // MIGRATION SHIM — remove once all importers updated
   export * from "%/application/collections/organization"
   export * from "%/application/collections/communication"
   export * from "%/application/collections/admin"
   ```

3. Migrate importers one PR at a time:
   - Route files (`_authenticated/projects/...`) — update `%` alias imports
   - Page components (`ChannelPage`, `TaskPage`, etc.)
   - Component files (`ResourceDisplay`, `CommentsSection`, etc.)

4. Once all importers updated: delete `admincollections.ts`

**Verification:** After each PR, run the app and verify the affected pages load and sync correctly.

---

### Phase 4 — Redirect `admin-schema.ts` Imports to `domain/`
**Risk: Medium** — ~29 files need import path updates.

After Phase 0 types are confirmed stable and Phase 2a schema split is done:

1. Update non-infrastructure files (components, pages, hooks) to import pure types from `%/domain/...` instead of `%/infrastructure/database/schema/admin-schema`
2. tRPC routers: import tables from `%/infrastructure/database/schema/communication-tables` etc., and Zod schemas from `%/domain/communication/validators` etc.
3. Once all importers updated: `admin-schema.ts` re-export barrel can be deleted (or kept indefinitely as a convenience barrel — low cost)

---

### Phase 5 — Reorganize `presentation/components/buildInlime/`
**Risk: Low-Medium** — purely organizational, no logic changes.

1. Create subdirectories:
   - `presentation/components/organization/`
   - `presentation/components/communication/`
   - `presentation/components/admin/`
2. Move component files into appropriate subdirectory
3. Update or create a barrel `presentation/components/index.ts` re-exporting everything — this is the single-file update that fixes all importers at once

**Component groupings:**
- **organization/**: BuildUnitsTable, ChannelCard, ChannelHeader, ChannelsSection, ProjectsTable, ProjectHeader, New*Button components
- **communication/**: CommentsSection, CommentInput, ResourcesSection, ResourceDisplay, PropertiesPanel, PropertiesInline, TaskDetailContent, TasksRightPanel, AssignedToSection, AddTaskButton, ActivityPanel, AddResourceForm, upload-schedule-popover
- **admin/**: Sidebar, SidebarProjects, HeaderLoggedIn, TeamSection

---

### Phase 6 — Move Hooks to `application/hooks/`
**Risk: Low** — 2 files, few importers.

1. Move `presentation/hooks/use-pending-resources.ts` → `application/hooks/use-pending-resources.ts`
2. Move `presentation/hooks/pending-resources-db.ts` → `application/hooks/pending-resources-db.ts`
3. Update importing components to use `%/application/hooks/use-pending-resources`
4. Delete empty `presentation/hooks/`

---

## Execution Order Summary

| Phase | What | Risk | Start condition |
|-------|------|------|-----------------|
| 0 | Create `domain/` layer | Zero | Anytime |
| 1 | Move tRPC to `routers/` subfolder | Low | Anytime |
| 2b | Extract `fileStorage.ts` | Low | Anytime |
| 2a | Split `admin-schema.ts` internals | Medium | After Phase 0 validates types |
| 3 | Create `application/collections/` | High | After Phase 0 + 2a |
| 4 | Redirect imports to `domain/` | Medium | After Phase 3 complete |
| 5 | Reorganize `presentation/components/` | Low-Medium | After Phase 4 |
| 6 | Move hooks to `application/` | Low | After Phase 5 |

**Best starting points (can run in parallel):** Phase 0, Phase 1, Phase 2b — all are independent and zero/low risk.

---

## Key Constraints (Do Not Violate)

1. **`presentation/routes/` files cannot move** — TanStack Router file-based routing
2. **`routes/api/auth/$.ts` must stay** — Better Auth handler path
3. **Never move + update all importers in the same commit** for large files — always use a re-export shim first
4. **Route files use relative imports for pages** — if page files ever move, relative paths in route files must be updated (see MEMORY.md for depth rules)
5. **`%` alias = `./src`** — use this in all cross-module imports to avoid fragile relative paths

---

## Critical Files

| File | Role in migration |
|------|------------------|
| `infrastructure/database/schema/admin-schema.ts` | Central dependency of 29 files — convert to barrel in Phase 2a |
| `infrastructure/database/tanstack-db-electric/admincollections.ts` | Central dependency of ~21 files — convert to re-export shim in Phase 3 |
| `presentation/routes/api/trpc/$.ts` | Only consumer of all tRPC routers — update 10 imports in Phase 1 |
| `presentation/components/buildInlime/` | 50+ components — reorganize into subfolders in Phase 5 |
