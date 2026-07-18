---
name: Insert data into DB via tRPC + Electric collection
description: This skill should be used when implementing a new form that writes data to the database in BuildInLime. Covers all layers needed: DB schema, tRPC router, Electric shape API route, Electric collection, and client-side form.
version: 1.0.0
---

# Inserting Data into the DB in BuildInLime

## Overview

BuildInLime uses a layered stack for all DB writes:

```
Client form → tasksCollection.insert() → onInsert hook → trpc.tasks.create.mutate()
                                                            → Drizzle INSERT into DB
                                                            → Electric sync back to client
```

The same pattern applies to all entities (projects, buildUnits, channels, properties, tasks).

---

## Files to Create / Modify

| Step | File | Action |
|---|---|---|
| 1 | `src/infrastructure/database/schema/admin-schema.ts` | Add table + Zod schemas |
| 2 | `src/infrastructure/trpc/<entity>.ts` | Create tRPC router |
| 3 | `src/presentation/routes/api/trpc/$.ts` | Register router in appRouter |
| 4 | `src/presentation/routes/api/<entity>.ts` | Electric shape proxy API route |
| 5 | `src/infrastructure/database/tanstack-db-electric/admincollections.ts` | Add Electric collection |
| 6 | `src/presentation/routes/.../<route>.tsx` | Preload collection in loader |
| 7 | `src/presentation/pages/<Page>.tsx` | Add form + call `collection.insert()` |

---

## Step-by-Step

### 1. Schema — `admin-schema.ts`

Define the Drizzle table and export Zod schemas:

```ts
export const tasksTable = pgTable(`tasks`, {
  id: text(`id`).primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  description: varchar({ length: 500 }).notNull(),
  completed: boolean().notNull().default(false),
  opened_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  closed_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  channel_id: text(`channel_id`).notNull().references(() => channelsTable.id, { onDelete: `cascade` }),
  buildunit_id: text(`buildunit_id`).notNull().references(() => buildUnitsTable.id, { onDelete: `cascade` }),
  createdby_id: text(`createdby_id`).notNull().references(() => users.id, { onDelete: `cascade` }),
  assignee_id: text(`assignee_id`).notNull().references(() => users.id, { onDelete: `cascade` }),
  members: text(`member_ids`).array().notNull(),
})

export const selectTaskSchema = createSelectSchema(tasksTable)
export const createTaskSchema = createInsertSchema(tasksTable).omit({
  opened_at: true,  // has defaultNow() — omit so it's not required in inserts
  closed_at: true,
})
export const updateTaskSchema = createUpdateSchema(tasksTable)
export type Task = z.infer<typeof selectTaskSchema>
```

> Columns with `defaultNow()` or `.default(...)` must be **omitted** from `createTaskSchema` so they're not required at insert time.

---

### 2. tRPC Router — `src/infrastructure/trpc/tasks.ts`

Copy the `properties.ts` pattern exactly:

```ts
import { router, authedProcedure, generateTxId } from "./lib/trpc"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import { tasksTable, createTaskSchema, updateTaskSchema } from "../database/schema/admin-schema"

export const tasksRouter = router({
  create: authedProcedure
    .input(createTaskSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [newItem] = await tx.insert(tasksTable).values(input).returning()
        return { item: newItem, txid }
      })
      return result
    }),

  update: authedProcedure
    .input(z.object({ id: z.string(), data: updateTaskSchema }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [updatedItem] = await tx
          .update(tasksTable).set(input.data).where(eq(tasksTable.id, input.id)).returning()
        if (!updatedItem) throw new TRPCError({ code: `NOT_FOUND`, message: `Task not found` })
        return { item: updatedItem, txid }
      })
      return result
    }),

  delete: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [deletedItem] = await tx
          .delete(tasksTable).where(eq(tasksTable.id, input.id)).returning()
        if (!deletedItem) throw new TRPCError({ code: `NOT_FOUND`, message: `Task not found` })
        return { item: deletedItem, txid }
      })
      return result
    }),
})
```

---

### 3. Register in App Router — `src/presentation/routes/api/trpc/$.ts`

```ts
import { tasksRouter } from "%/infrastructure/trpc/tasks"

export const appRouter = router({
  // ...existing routers...
  tasks: tasksRouter,
})
```

---

### 4. Electric Shape — a descriptor plus a route shell

Two pieces. **Do not** hand-write an auth check or an Electric proxy call in a route
file — `shapeHandler` owns those, and a route that rolls its own is how the shape
routes drifted apart last time.

First, the authorization rule, in `src/infrastructure/database/shapes.ts` alongside
the other fourteen:

```ts
export const tasksShape: ShapeDef = {
  table: `tasks`,
  scope: `member`, // resolves the caller's visible ids from the SESSION
  where: ({ scope }) => and(idSetWhere(`channel_id`, scope.channelIds), notDeleted),
}
```

Then the route shell, `src/presentation/routes/api/tasks.ts` — a path and nothing else:

```ts
import { createFileRoute } from "@tanstack/react-router"
import { shapeHandler } from "../../../infrastructure/database/shape-route"
import { tasksShape } from "../../../infrastructure/database/shapes"

export const Route = createFileRoute("/api/tasks")({
  server: { handlers: { GET: shapeHandler(tasksShape) } },
})
```

Rules that matter:

- **Scope comes from the session, never from a query param.** Declaring
  `scope: "member"` gives `where` the caller's `{channelIds, buildunitIds,
  projectIds}` via `resolveMemberScope`. Taking ids from the URL is the
  broken-access-control bug described in ARCHITECTURE.md §4 — a client can pass
  someone else's ids. Omit `scope` only when the clause is purely session-derived
  (`user_id = me`, `owner_id = me`).
- **Empty id set must be default-deny.** `idSetWhere` returns `1 = 0`. Use
  `idSetOrOmit` only inside an `or()` that already has an unconditional clause such
  as `owner_id = me`.
- **Add a case to `tests/unit/shapes.test.ts`** pinning the emitted `where` string.
  The descriptors are pure, so this is cheap, and it is what keeps an authorization
  boundary from moving silently.

---

### 5. Electric Collection — `admincollections.ts`

```ts
import { selectTaskSchema } from "../schema/admin-schema"

export const tasksCollection = createCollection(
  electricCollectionOptions({
    id: `tasks`,
    shapeOptions: {
      url: new URL(`/api/tasks`, typeof window !== `undefined` ? window.location.origin : `https://localhost:5173`).toString(),
      parser: { timestamptz: (date: string) => new Date(date) },
    },
    schema: selectTaskSchema,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const { modified: newTask } = transaction.mutations[0]
      const result = await trpc.tasks.create.mutate({
        id: newTask.id,
        name: newTask.name,
        description: newTask.description,
        completed: newTask.completed,
        channel_id: newTask.channel_id,
        buildunit_id: newTask.buildunit_id,
        createdby_id: newTask.createdby_id,
        assignee_id: newTask.assignee_id,
        members: newTask.members,
      })
      return { txid: result.txid }
    },
    onUpdate: async ({ transaction }) => {
      const { modified: updatedTask } = transaction.mutations[0]
      const result = await trpc.tasks.update.mutate({
        id: updatedTask.id,
        data: { name: updatedTask.name, description: updatedTask.description, completed: updatedTask.completed },
      })
      return { txid: result.txid }
    },
    onDelete: async ({ transaction }) => {
      const { original: deletedTask } = transaction.mutations[0]
      const result = await trpc.tasks.delete.mutate({ id: deletedTask.id })
      return { txid: result.txid }
    },
  })
)
```

---

### 6. Preload in Route Loader

In the route file that renders the page using this collection:

```ts
loader: async () => {
  await Promise.all([
    // ...existing preloads...
    tasksCollection.preload(),
  ])
},
```

---

### 7. Client Form — Call `collection.insert()`

```tsx
import { tasksCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { useSession } from "%/infrastructure/auth/client"

const { data: session } = useSession()
const [taskFormOpen, setTaskFormOpen] = useState(false)
const [taskName, setTaskName] = useState("")
const [taskDesc, setTaskDesc] = useState("")
const [isSubmitting, setIsSubmitting] = useState(false)

const handleSubmit = async (e: FormEvent) => {
  e.preventDefault()
  if (!session?.user || !channelId || !buildUnitId || !taskName.trim()) return
  setIsSubmitting(true)
  try {
    await tasksCollection.insert({
      id: crypto.randomUUID(),
      name: taskName.trim(),
      description: taskDesc.trim(),
      completed: false,
      channel_id: channelId,
      buildunit_id: buildUnitId,
      createdby_id: session.user.id,
      assignee_id: session.user.id,
      members: [session.user.id],
    })
    setTaskName(""); setTaskDesc(""); setTaskFormOpen(false)
  } finally {
    setIsSubmitting(false)
  }
}
```

> **Guard**: Always check `session?.user` AND all required FK ids before calling `insert()`. A missing FK id silently aborts the `onInsert` hook if tRPC throws a NOT_NULL constraint error.

---

## DB Migration Checklist

After modifying `admin-schema.ts`, sync the DB:

```bash
pnpm migrate:generate   # generates SQL in drizzle/
pnpm migrate            # applies to DB
```

### Common migration failures

| Error | Cause | Fix |
|---|---|---|
| `drizzle-kit generate` interactive prompt | Column rename detected — can't handle non-interactively | Write migration SQL manually; compute SHA256 hash; insert into `drizzle.__drizzle_migrations` |
| `column "X" already exists` | Migration partially applied | Skip that statement; check `\d tablename` first |
| Snapshot chain collision (`two snapshots point to same parent`) | Two migrations generated from same prevId | Fix the later snapshot's `prevId` → see `propertyAddition` skill troubleshooting |

### Writing migration manually (when `generate` is blocked)

```bash
# 1. Write the SQL file
cat > drizzle/0006_my_migration.sql << 'EOF'
ALTER TABLE "tasks" RENAME COLUMN "text" TO "name";
ALTER TABLE "tasks" ADD COLUMN "description" varchar(500) NOT NULL DEFAULT '';
ALTER TABLE "tasks" ALTER COLUMN "description" DROP DEFAULT;
EOF

# 2. Compute hash
sha256sum drizzle/0006_my_migration.sql | cut -d' ' -f1

# 3. Apply SQL directly (dev only, no data at risk)
psql "$DATABASE_URL" -f drizzle/0006_my_migration.sql

# 4. Record migration as applied
psql "$DATABASE_URL" -c "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('<hash>', $(date +%s%3N));"
```

---

## Troubleshooting

### `collection.insert()` fails with schema validation error — "created_at vs opened_at" (or similar column mismatch)

**Symptom:** The insert call throws a Zod validation error referencing a timestamp column name that doesn't match the schema (e.g. expected `opened_at`, received `created_at`).

**Cause:** The collection uses `selectTaskSchema` for local validation, which requires **all** `NOT NULL` columns — including timestamp columns like `opened_at` and `closed_at` — even if they have `defaultNow()` in the DB. The `createTaskSchema` omits them (so the DB fills them in on the server side), but the **client-side** `collection.insert()` call must still supply them to pass schema validation.

**Fix:** Always pass timestamp fields explicitly in the `insert()` call:

```ts
await tasksCollection.insert({
  id: crypto.randomUUID(),
  name: taskName.trim(),
  description: taskDesc.trim(),
  completed: false,
  opened_at: new Date(),   // ← required by selectTaskSchema even though DB has defaultNow()
  closed_at: new Date(),   // ← same
  channel_id: channelId,
  buildunit_id: buildUnitId,
  createdby_id: session.user.id,
  assignee_id: session.user.id,
  members: [session.user.id],
})
```

> **Rule of thumb:** `createSchema` (used by tRPC) governs what the *server* requires. `selectSchema` (used by the collection) governs what the *client* requires for local optimistic inserts. Any `NOT NULL` column without a client-provided value will fail `selectSchema` validation even if the DB would supply a default.

### Boolean columns arrive as strings `"true"`/`"false"`, causing tRPC mutation failures

**Symptom:** A collection write (e.g. `tasksCollection.update()`) appears to do nothing — the `onUpdate` handler is called but the tRPC mutation is silently rejected.

**Cause:** Electric returns all boolean columns as the strings `"true"` or `"false"`. The collection's `onUpdate` handler then passes these strings to tRPC, which validates against `updateTaskSchema` (e.g. `completed: z.boolean().optional()`). The string `"false"` fails `z.boolean()` validation → tRPC throws → no DB write.

**Fix — two parts:**

1. Define an `electricTaskSchema` that preprocesses boolean columns before storing them in the collection:

```ts
const coerceBool = (v: unknown) => v === "true" || v === true

const electricTaskSchema = selectTaskSchema.extend({
  completed: z.preprocess(coerceBool, z.boolean()),
})
// use electricTaskSchema (not selectTaskSchema) in tasksCollection
```

2. Also coerce in `onUpdate` as a safety measure:

```ts
onUpdate: async ({ transaction }) => {
  const { modified: updatedTask } = transaction.mutations[0]
  const result = await trpc.tasks.update.mutate({
    id: updatedTask.id,
    data: {
      completed: coerceBool(updatedTask.completed),  // ← coerce here too
      assignee_id: updatedTask.assignee_id,
      // ...
    },
  })
```

> **Rule of thumb:** Any table with `boolean` columns needs an `electric<Entity>Schema` that wraps those columns with `z.preprocess(coerceBool, z.boolean())`. Always coerce in `onUpdate` as well, since the collection state may have been populated before the schema fix was deployed.

---

### Electric uses DB column names, not Drizzle JS property names — `member_ids` vs `members`

**Symptom:** Client-side code accessing a collection item field (e.g. `channel.members`) always gets `undefined` even though the DB row has data.

**Cause:** Electric always returns the raw PostgreSQL column name (e.g. `member_ids`). Drizzle table definitions can map a different JS property name to that column:

```ts
members: text('member_ids').array().notNull()
//  ↑ JS property name        ↑ actual DB column name
```

`createSelectSchema` generates a Zod schema with the JS property name (`members`), but TanStack DB stores the raw Electric data under the DB column name (`member_ids`). Accessing `channel.members` at runtime returns `undefined`.

**Affected fields in this codebase:** every `members: text('member_ids')` column across `projectsTable`, `buildUnitsTable`, `channelsTable`, `tasksTable`, `messagesTable`, `resourcesTable`, `propertiesTable`.

**Fix:** When reading `member_ids` client-side, access the DB column name explicitly via a type-cast:

```ts
const channelRaw = channel as unknown as Record<string, unknown>
const rawMembers = channelRaw['member_ids'] ?? channelRaw['members']
```

The `?? channelRaw['members']` fallback handles the case where TanStack DB eventually does apply schema key mapping.

> **Rule of thumb:** Never assume a Drizzle JS property name equals what Electric sends. Always check the actual DB column name (the string argument to `text('...')`) and use that key when reading raw collection data client-side.

---

### `text[]` columns arrive as PostgreSQL array literal strings, not JS arrays

**Symptom:** Client-side code that uses a `text[]` column (like `member_ids`) for filtering always produces an empty result, even though the DB has data.

**Cause:** Electric SQL returns PostgreSQL `text[]` columns as raw array literal strings — e.g. `"{id1,id2}"` — not as JavaScript arrays. `Array.isArray("{id1}")` is `false`, so defensive guards like `Array.isArray(channel.members) ? channel.members : []` silently return `[]`.

**Fix:** Parse the PG array literal string into a JS array before using it client-side:

```ts
const rawMembers = channel.members as unknown
const channelMemberIds: string[] = Array.isArray(rawMembers)
  ? (rawMembers as string[])
  : typeof rawMembers === 'string' && rawMembers.startsWith('{') && rawMembers.endsWith('}')
    ? rawMembers.slice(1, -1).split(',').filter(Boolean)
    : []
```

> **Note:** This only affects client-side JS usage. Server-side Electric `where` filters like `'userId' = ANY(member_ids)` work correctly on the raw PG array column and are unaffected.

---

### Electric collection returns no items — camelCase/snake_case schema mismatch (`usersCollection` or any auth-schema table)

**Symptom:** A collection backed by the Better Auth `users` table (or any table where Drizzle JS property names differ from DB column names) appears empty — `useLiveQuery` returns `[]` even though rows exist in the DB.

**Cause:** `createSelectSchema(users)` (drizzle-zod) generates a Zod schema with **camelCase** JS property names (`emailVerified`, `createdAt`, `updatedAt`), because that's how they're defined in `auth-schema.ts`. But Electric SQL always returns the raw **snake_case** DB column names (`email_verified`, `created_at`, `updated_at`). Every incoming row fails schema validation and is dropped from the collection.

This only affects tables where the Drizzle JS key differs from the SQL column name (i.e. `emailVerified: boolean('email_verified')`). Tables in `admin-schema.ts` use matching snake_case for both, so they're unaffected.

**Fix:** Don't use `selectUsersSchema` for the Electric collection. Define a custom schema that uses the snake_case keys Electric actually sends:

```ts
// In admincollections.ts — replaces `schema: selectUsersSchema`
const electricUsersSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  email_verified: z.boolean().optional(),
  image: z.string().nullable().optional(),
  created_at: z.union([z.string(), z.date()]).optional(),
  updated_at: z.union([z.string(), z.date()]).optional(),
})

export const usersCollection = createCollection(
  electricCollectionOptions({
    // ...
    schema: electricUsersSchema,   // ← not selectUsersSchema
    getKey: (item) => item.id,
  })
)
```

> **Rule of thumb:** For any Electric collection, the `schema` must match the raw DB column names (snake_case), not the Drizzle JS property names. Use `selectSchema` only when both names are identical (i.e. all `admin-schema.ts` tables). For `auth-schema.ts` tables, always write a custom Electric schema.

---

## Key Patterns

- **`generateTxId(tx)`** — must be called inside a DB transaction; returns the Postgres XID that Electric uses to match the server write to the client's optimistic update
- **`members` array** — must include at least the `session.user.id`; Electric's shape API filters rows by `'userId' = ANY(member_ids)`
- **`crypto.randomUUID()`** — always generate the `id` client-side before calling `collection.insert()` so the collection can optimistically render it immediately
- **`onInsert` field list** — must explicitly list all fields passed to tRPC (spread `...newItem` won't work because TanStack DB may include internal collection metadata)
