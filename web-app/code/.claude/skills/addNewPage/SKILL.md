---
name: addNewPage
description: This skill should be used when the user asks to "populate a page", "build out a page component", "implement a page similar to ChannelPage", "add content to a page", or any task that involves writing a full page component in BuildInLime's src/presentation/pages/ directory.
version: 1.0.0
---

# Add New Page Component

This skill covers the pattern for implementing a full page component in BuildInLime. Pages live in `src/presentation/pages/` and receive all data as props from their route component — they contain no router or database logic.

---

## Page Component Contract

- **Named export** — always `export function FooPage(...)`, never default
- **No router imports** — no `createFileRoute`, no `useLiveQuery`
- **All data via props** — IDs, names, live-queried records, mapped domain types
- **Route wires the data** — the corresponding route file in `routes/` does all data fetching and passes shaped props

---

## Full Page Layout Pattern

Every app page follows this structure (modelled on `ChannelPage.tsx` and `TaskPage.tsx`):

```tsx
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronRight, ChevronDown, Link as LinkIcon, Bell, PanelRight,
  SomeIcon,            // domain icon for ChannelHeader
} from "lucide-react";
import {
  Sidebar, ChannelHeader, PropertiesInline, ResourcesSection,
} from "../components/buildInlime";
import { PropertiesPanel } from "../components/buildInlime/PropertiesPanel";
import type { Property } from "%/infrastructure/database/schema/admin-schema";

interface FooPageProps {
  projectId: string;
  projectName: string;
  // ...other IDs and names needed for breadcrumb and data
  fooId: string;
  fooName: string;
  fooDescription: string;
  properties: Property[];
}

export function FooPage({ projectId, projectName, ... }: FooPageProps) {
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [fooPropsOpen, setFooPropsOpen] = useState(true);

  return (
    <div className="flex h-screen bg-white font-['Instrument_Sans',sans-serif]">
      <Sidebar buildUnitsNavTo="/project-details" buildUnitsNavActive={true} />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top nav */}
        <header className="border-b border-gray-200 bg-white px-6 py-2">
          {/* breadcrumb + action buttons */}
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Main content */}
          <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
            <ChannelHeader icon={SomeIcon} title={fooName} description={fooDescription} />
            <PropertiesInline properties={properties} buildUnitId={fooId} entity="foo" />
            <ResourcesSection />
          </div>

          {/* Right panel */}
          {rightPanelOpen && (
            <aside className="w-72 bg-[#fdf8f2] border-l border-[#e5d4c1] overflow-y-auto p-6 space-y-8">
              {/* Properties section with collapsible sub-sections */}
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
```

---

## Section Reference

### Sidebar
```tsx
<Sidebar buildUnitsNavTo="/project-details" buildUnitsNavActive={true} />
```
Use `buildUnitsNavActive={true}` on all authenticated inner pages.

### Top Navigation Bar

Breadcrumb pattern — each ancestor is a `Link`, current page is a `<span>`:

```tsx
<header className="border-b border-gray-200 bg-white px-6 py-2">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2 text-[#717182] text-sm">
      <Link to="/projects/$projectId" params={{ projectId }} className="hover:text-[#1e1e1e] transition-colors">
        {projectName}
      </Link>
      <ChevronRight className="w-4 h-4" />
      <Link href={`/projects/${projectId}/${buildUnitName}`} className="hover:text-[#1e1e1e] transition-colors">
        {buildUnitName}
      </Link>
      <ChevronRight className="w-4 h-4" />
      {/* ...more ancestors... */}
      <span className="text-[#1e1e1e]">{currentPageName}</span>
    </div>
    <div className="flex items-center gap-2">
      <button className="p-1.5 text-[#717182] hover:bg-gray-100 rounded transition-colors">
        <LinkIcon className="w-4 h-4" />
      </button>
      <button className="p-1.5 text-[#717182] hover:bg-gray-100 rounded transition-colors">
        <Bell className="w-4 h-4" />
      </button>
      <button onClick={() => setRightPanelOpen(!rightPanelOpen)} className="p-1.5 text-[#717182] hover:bg-gray-100 rounded transition-colors">
        <PanelRight className="w-4 h-4" />
      </button>
    </div>
  </div>
</header>
```

Note: `to` + `params` is used for routes with typed params (`$projectId`). `href` string interpolation is used for deeper segments (`buildUnitName`, `channelName`) where path matching is simpler.

### ChannelHeader (title + description)
```tsx
<ChannelHeader icon={SomeIcon} title={entityName} description={entityDescription} />
```
- `icon` — a LucideIcon component (not JSX, just the reference)
- `title` — entity name shown as h1
- `description` — subtitle text
- For tasks: always use `Hammer` icon

### PropertiesInline (inline property pills below the header)
```tsx
<PropertiesInline properties={properties} buildUnitId={entityId} entity="task" />
```
- `entity` must be one of: `"project" | "buildUnit" | "channel" | "task"` (from `ENTITY_TYPES`)
- `buildUnitId` — the ID of the entity these properties belong to (despite the name, it's used for any entity)

### ResourcesSection
```tsx
<ResourcesSection />
```
No required props. Renders the file attachment area.

### Right Panel — Properties Section

Collapsible outer section + collapsible sub-sections for each entity scope:

```tsx
<aside className="w-72 bg-[#fdf8f2] border-l border-[#e5d4c1] overflow-y-auto p-6 space-y-8">
  <div>
    <button onClick={() => setPropertiesOpen(!propertiesOpen)} className="flex items-center justify-between w-full mb-4">
      <h3 className="text-sm font-medium text-[#717182]">Properties</h3>
      {propertiesOpen ? <ChevronDown className="w-4 h-4 text-[#717182]" /> : <ChevronRight className="w-4 h-4 text-[#717182]" />}
    </button>
    {propertiesOpen && (
      <div className="space-y-6">
        {/* Sub-section per entity scope */}
        <div>
          <button onClick={() => setSubOpen(!subOpen)} className="flex items-center justify-between w-full mb-3">
            <p className="text-xs text-[#ac7f5e]">SubSectionLabel</p>
            {subOpen ? <ChevronDown className="w-3 h-3 text-[#ac7f5e]" /> : <ChevronRight className="w-3 h-3 text-[#ac7f5e]" />}
          </button>
          {subOpen && (
            <PropertiesPanel properties={properties} buildUnitId={entityId} hideLabel />
          )}
        </div>
      </div>
    )}
  </div>
</aside>
```

`PropertiesPanel` props:
- `properties` — the `Property[]` array for that sub-section's entity
- `buildUnitId` — the entity ID (task ID, channel ID, or build unit ID)
- `hideLabel` — always pass this; the sub-section header is the label
- `hideAddButton` — pass when showing a parent entity's properties read-only (e.g. build unit props on a channel page)
- `label` — entity name shown next to add button (used when `hideAddButton` is false)

---

## Right Panel Content by Page Type

| Page | Sub-sections | Notes |
|---|---|---|
| `ChannelPage` | Channel + Build Unit | Build Unit has `hideAddButton` |
| `TaskPage` | Task only | Single sub-section |
| `BuildUnitPage` | Build Unit only | — |

---

## TaskPage Pattern (reference implementation)

`TaskPage` is the canonical example of a deeply nested page. Key points:
- Breadcrumb: `projectName > buildUnitName > channelName > taskName`
- Icon: always `Hammer` (same for every task)
- `PropertiesInline` with `entity="task"` and `buildUnitId={taskId}`
- Right panel: Properties section → Task sub-section only
- No Comments section, no TasksRightPanel

Props interface:
```tsx
interface TaskPageProps {
  projectId: string;
  projectName: string;
  buildUnitName: string;
  channelName: string;
  taskId: string;
  taskName: string;
  taskDescription: string;
  properties: Property[];
}
```

---

## Corresponding Route File Checklist

When building the page, also update the route file to pass the right props:

- [ ] Add `loader` with all required `collection.preload()` calls
- [ ] Chain `useLiveQuery` calls to resolve IDs (project → buildUnit → channel → task)
- [ ] Map raw DB rows to `Property[]` (unwrap JSONB, handle snake_case fallback)
- [ ] Pass all resolved values as typed props to the page component
- [ ] Remove the old placeholder props (e.g. just `taskName: string` from the URL param)
