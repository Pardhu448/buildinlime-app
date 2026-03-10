---
name: Adding a new property type in BuildInLime
description: This skill should be used when the user asks to "add a new property type", "add a property", "create a property type", or mentions adding a new field to the properties system in BuildInLime. Covers all infrastructure and presentation changes needed to introduce a new property type end-to-end.
version: 1.0.0
---

# Adding a New Property Type in BuildInLime

## Overview

Properties in BuildInLime are stored in the `properties` table and rendered via `PropertiesInline` (inline pill row) and `PropertiesPanel` (right panel list). Adding a new property type requires changes across the schema, collections, and both presentation components.

## Files to Modify

| File | Purpose |
|---|---|
| `src/infrastructure/database/schema/admin-schema.ts` | Schema: add type to enum, add DB column, extend Zod schema |
| `src/infrastructure/database/tanstack-db-electric/admincollections.ts` | Pass new field in `onInsert` |
| `src/presentation/components/buildInlime/PropertiesInline.tsx` | Inline pill row UI + add-property form |
| `src/presentation/components/buildInlime/PropertiesPanel.tsx` | Right panel list UI + add-property form |

---

## Step-by-Step

### 1. Schema — `admin-schema.ts`

**a) Add the type name to `PROPERTY_TYPES`:**
```ts
export const PROPERTY_TYPES = [
  "priority", "status", "targetDate", "startDate",
  "pendingTask", "percent_complete",
  "label",   // ← add here
] as const
```

**b) Add a column to `propertiesTable`:**
```ts
export const propertiesTable = pgTable(`properties`, {
  // ...existing columns...
  pendingTask: text(`pending_task`),
  labelValue: text(`label_value`),   // ← add here (text for text input types)
  members: text(`member_ids`).array().notNull(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
```

**c) Extend `selectPropertySchema`:**
```ts
export const selectPropertySchema = createSelectSchema(propertiesTable).extend({
  // ...existing fields...
  pendingTask: z.string().nullish(),
  labelValue: z.string().nullish(),  // ← add here
})
```

> For enum-typed values (like `status` / `priority`), add a new `as const` array and a `jsonb` column instead of a `text` column.

---

### 2. Collections — `admincollections.ts`

In the `onInsert` handler for `propertiesCollection`, pass the new field:

```ts
onInsert: async ({ transaction }) => {
  const { modified: newProperty } = transaction.mutations[0]
  const result = await trpc.properties.create.mutate({
    // ...existing fields...
    pendingTask: newProperty.pendingTask,
    labelValue: newProperty.labelValue,   // ← add here
    members: newProperty.members,
  })
  return { txid: result.txid }
},
```

> The tRPC `create` procedure uses `createPropertySchema` directly, so it picks up new columns automatically — no changes needed in `properties.ts`.

---

### 3. PropertiesInline — `PropertiesInline.tsx`

**a) Import the icon:**
```ts
import { ..., Tag } from "lucide-react";
```

**b) Add to `PILL_LABELS`:**
```ts
const PILL_LABELS: Record<typeof PROPERTY_TYPES[number], string> = {
  // ...
  label: "Label",
}
```

**c) Add to `PROPERTY_TYPE_LABELS`:**
```ts
const PROPERTY_TYPE_LABELS: Record<typeof PROPERTY_TYPES[number], string> = {
  // ...
  label: "Label",
}
```

**d) Add a case in `PropertyPill`:**
```ts
case "label":
  icon = <Tag className="w-3 h-3 shrink-0 text-purple-600" />
  break
```

**e) Add `labelValue` to `ValueState` and `DEFAULT_VALUE_STATE`:**
```ts
type ValueState = {
  // ...
  labelValue: string;
};

const DEFAULT_VALUE_STATE: ValueState = {
  // ...
  labelValue: "",
};
```

**f) Add a case in `renderValueInput`:**
```ts
case "label":
  return (
    <input
      type="text"
      value={valueState.labelValue}
      onChange={(e) => setValueState((v) => ({ ...v, labelValue: e.target.value }))}
      placeholder="Enter label text"
      required
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#976623] focus:border-transparent"
    />
  );
```

**g) Add `labelValue` to the `base` object in `handleSubmit`:**
```ts
const base = {
  // ...
  pendingTask: undefined as string | undefined,
  labelValue: undefined as string | undefined,  // ← add
};
```

**h) Add a case in the `switch` inside `handleSubmit`:**
```ts
case "label":
  base.labelValue = valueState.labelValue;
  break;
```

---

### 4. PropertiesPanel — `PropertiesPanel.tsx`

Apply the same changes as `PropertiesInline`:

- Import icon (`Tag`)
- Add to `PILL_LABELS` and `PROPERTY_TYPE_LABELS`
- Add case in `ValuePill` (use `property.labelValue` for the display label)
- Add `labelValue` to `ValueState`, `DEFAULT_VALUE_STATE`, and `base` object
- Add case in `renderValueInput`
- Add case in `handleSubmit`

```ts
// ValuePill case:
case "label":
  icon = <Tag className="w-2.5 h-2.5 shrink-0 text-purple-600" />
  label = property.labelValue ?? "—"
  break
```

---

### 5. Run DB Migration

After updating the schema, generate and apply the migration:

```bash
pnpm migrate:generate && pnpm migrate
```

---

## Property Type Patterns

| Input type | Column type | ValueState field | Example types |
|---|---|---|---|
| Text input | `text(...)` | `textValue` or dedicated string | `pendingTask`, `label` |
| Number input | `text(...)` (stored as string) | `textValue` | `percent_complete` |
| Date input | `text(...)` | `dateValue` | `targetDate`, `startDate` |
| Enum select | `jsonb(...).$type<...>()` | dedicated enum field | `status`, `priority` |

> Enum types stored as `jsonb` arrive from ElectricSQL as JSON-encoded strings (e.g. `'"critical"'`). They are unwrapped via `z.preprocess(unwrapJsonb, z.enum(...))` in `electricPropertySchema` inside `admincollections.ts`.

---

## Troubleshooting

### `properties.create` tRPC call returns 500 — "column X does not exist"

**Symptom:** Inserting a property fails with `error: column "label_value" of relation "properties" does not exist`.

**Cause:** The column was added to `propertiesTable` in `admin-schema.ts` but the DB migration was never generated and applied.

**Fix:**

1. **If `pnpm migrate:generate` errors with "collision" (two snapshots share the same `prevId`):**

   The drizzle snapshot chain is broken — two migrations were generated from the same parent. Fix it by updating the later snapshot's `prevId` to point to the earlier one's `id`:

   ```bash
   # Find the IDs:
   python3 -c "import json; d=json.load(open('drizzle/meta/0003_snapshot.json')); print('0003 id:', d['id'])"
   python3 -c "import json; d=json.load(open('drizzle/meta/0004_snapshot.json')); print('0004 prevId:', d['prevId'])"

   # Fix: set 0004's prevId to 0003's id
   python3 -c "
   import json
   path = 'drizzle/meta/0004_snapshot.json'
   d = json.load(open(path))
   d['prevId'] = '<0003-id-here>'
   json.dump(d, open(path,'w'), indent=2)
   "
   ```

   Then re-run `pnpm migrate:generate`.

2. **If `pnpm migrate` errors with "relation already exists":**

   A migration file exists but was never recorded in `drizzle.__drizzle_migrations` (e.g. it was applied manually or partially). Insert its record:

   ```bash
   # Compute hash of the unrecorded migration SQL file:
   sha256sum drizzle/0004_reflective_garia.sql | cut -d' ' -f1

   # Insert into migrations tracking table (use the timestamp from _journal.json):
   psql "$DATABASE_URL" -c "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('<hash>', <timestamp>);"
   ```

   Then re-run `pnpm migrate` — it will skip already-recorded migrations and apply only the new one.

3. **If both issues are resolved**, `pnpm migrate:generate && pnpm migrate` should work cleanly and add the missing column.
