# BuildInLime Architecture Summary

## 📄 Document Generated
**File:** `software-architecture-design.md`  
**Size:** 3,195 lines  
**Status:** ✅ Complete

---

## 🎯 Architecture Overview

### **Core Principles**
1. **Client-First** - Business logic on client, backend is just database + sync
2. **Local-First** - Offline-capable, no spinners, instant UI updates
3. **Functional Programming** - Immutable data, pure functions, type safety
4. **Domain-Driven Design** - Four bounded contexts with clear separation

### **Technology Stack**

#### Frontend
- **React 18** + **TypeScript 5.0+**
- **TanStack Start** (Meta-framework)
- **TanStack DB** (Client-side state management)
- **TanStack Router** (Type-safe routing)
- **Drizzle ORM** + **drizzle-zod** (End-to-end type safety)
- **ElectricSQL** (Local-first sync)
- **tRPC** (Type-safe API layer)
- **Better Auth** (Session management)

#### Backend (Minimal)
- **PostgreSQL 15+** with **PostGIS**
- **ElectricSQL Sync Service**
- **TanStack Start** (Shape proxy routes + tRPC)
- **Google Cloud Platform** (Deployment)

---

## 🏗️ Key Architectural Features

### **1. Drizzle ORM + drizzle-zod Integration** ✨
**Complete type safety from database to UI:**

```
Drizzle Schema Definition
        ↓
drizzle-zod Auto-Generation
        ↓
Zod Validation Schemas
        ↓
TypeScript Types
        ↓
TanStack DB Collections
        ↓
React Components
```

**Benefits:**
- ✅ Single source of truth for data models
- ✅ No manual type duplication
- ✅ Compile-time error detection
- ✅ Database constraints reflected in types
- ✅ Automatic schema validation

### **2. TanStack DB State Management** 🔄
**Replaces traditional state management libraries:**

- State lives in **local database** (not Redux/Zustand)
- **Live queries** (`useLiveQuery`) for reactive UI
- **Optimistic updates** with automatic rollback
- **Cross-collection joins** for complex queries
- Background sync via ElectricSQL

### **3. Three-Layer Authorization** 🔒
**Multi-layer security approach:**

1. **Shape Proxy Routes** - Filter data at sync level (`WHERE user_id = ?`)
2. **tRPC Mutations** - Validate ownership before writes
3. **PostgreSQL RLS** - Row-level security as final defense

### **4. Local-First Architecture** 🌐
**No network dependency:**

- All data cached locally (IndexedDB/SQLite)
- Instant UI updates (optimistic mutations)
- Full offline functionality
- Background sync when online
- CRDT-based conflict resolution

---

## 📊 Four Bounded Contexts

### **1. Admin Context**
- User identity and authentication
- Role-based access control (RBAC)
- Team/project membership
- Privacy settings

### **2. Organization Context**
- Project hierarchy
- BuildUnit management
- Communication channel structure
- Resource allocation

### **3. Communication Context**
- Multi-modal messaging (text, audio, video, images)
- Artifact management
- Sign-off workflows
- Conversation threading

### **4. AI-Support Context**
- Voice-to-text transcription (Whisper)
- Data extraction (GPT-4)
- Channel/BuildUnit summarization
- Natural language queries

---

## 🔄 Data Flow

### **Message Creation Example**
```
User types message
       ↓
messageCollection.insert() (TanStack DB)
       ↓
UI updates IMMEDIATELY (optimistic)
       ↓
collection.onInsert → tRPC mutation (background)
       ↓
tRPC validates authorization
       ↓
ElectricSQL syncs to PostgreSQL
       ↓
Other clients receive update
       ↓
Their UIs auto-update (live queries)
```

---

## 💻 Code Examples

### **Drizzle Schema → Auto-Generated Types**

```typescript
// 1. Define Drizzle schema
export const projectsTable = pgTable('projects', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  properties: jsonb('properties').$type<ProjectProperties>().notNull(),
})

// 2. Auto-generate Zod schemas
export const selectProjectSchema = createSelectSchema(projectsTable)
export const insertProjectSchema = createInsertSchema(projectsTable)

// 3. Infer TypeScript types
export type Project = z.infer<typeof selectProjectSchema>
export type InsertProject = z.infer<typeof insertProjectSchema>

// 4. Use in TanStack DB
export const projectCollection = createCollection({
  schema: selectProjectSchema, // Type-safe!
})

// 5. Use in tRPC
export const projectsRouter = router({
  create: authedProcedure
    .input(insertProjectSchema) // Auto-validated!
    .mutation(async ({ input }) => { /* ... */ })
})
```

### **Live Queries with Joins**

```typescript
const ChannelMessages: React.FC = ({ channelId }) => {
  // Auto-updates when data changes!
  const { data: messages } = useLiveQuery((q) =>
    q
      .from({ msg: messageCollection })
      .join({ user: userCollection }, ({ msg, user }) =>
        eq(msg.authorId, user.id)
      )
      .where(({ msg }) => eq(msg.channelId, channelId))
      .select(({ msg, user }) => ({
        id: msg.id,
        content: msg.content,
        authorName: user.profile.displayName,
      }))
  )

  return (
    <div>
      {messages.map(msg => <MessageItem key={msg.id} message={msg} />)}
    </div>
  )
}
```

### **Optimistic Mutations**

```typescript
const createProject = async (name: string) => {
  // UI updates IMMEDIATELY
  await projectCollection.insert({
    id: generateId(),
    name,
    properties: { status: 'Planning' },
    createdAt: new Date(),
  })
  
  // Sync happens in background
  // Auto-rollback on error
}
```

---

## 🚀 Development Roadmap (18 Weeks)

### **Phase 1: Foundation** (Weeks 1-3)
- TanStack Start + TanStack DB setup
- PostgreSQL + ElectricSQL integration
- Drizzle ORM schema
- Better Auth authentication

### **Phase 2: Organization Context** (Weeks 4-6)
- Project management
- BuildUnit CRUD
- Communication channels

### **Phase 3: Communication Features** (Weeks 7-9)
- Chat with live updates
- Rich media support
- Artifact sign-offs

### **Phase 4: Mobile Application** (Weeks 10-12)
- React Native setup
- Camera/audio integration
- Offline sync

### **Phase 5: AI Integration** (Weeks 13-15)
- Whisper transcription
- GPT-4 data extraction
- Summarization

### **Phase 6: Polish & Launch** (Weeks 16-18)
- Performance optimization
- Security audit
- Production deployment

---

## 📁 Project Structure

```
src/
├── domain/              # Pure business logic (functional)
│   ├── admin/
│   ├── organization/
│   ├── communication/
│   └── ai-support/
│
├── application/         # TanStack DB collections & hooks
│   ├── collections/     # State management via TanStack DB
│   ├── hooks/          # useLiveQuery hooks
│   └── use-cases/      # Business workflows
│
├── infrastructure/      # External integrations
│   ├── database/
│   │   ├── schema.ts   # Drizzle schema (single source of truth)
│   │   ├── schemas.ts  # Auto-generated Zod schemas
│   │   └── drizzle.ts  # Drizzle client
│   ├── trpc/           # tRPC routers
│   └── electric/       # ElectricSQL setup
│
└── presentation/        # React components
    ├── components/
    └── pages/
```

---

## 🔑 Key Decisions

| Decision | Rationale |
|----------|-----------|
| **TanStack DB** | Perfect local-first match with ElectricSQL |
| **Drizzle ORM** | Better PostgreSQL support than Prisma |
| **drizzle-zod** | Auto-generate schemas, no duplication |
| **TanStack Start** | Full-stack React with built-in API routes |
| **Better Auth** | Simple session-based authentication |
| **tRPC** | End-to-end type safety for mutations |
| **ElectricSQL** | Best local-first sync for PostgreSQL |

---

## ✅ Architecture Benefits

### **1. Developer Experience**
- Hot module reloading
- Type errors at compile-time
- No manual type duplication
- Auto-completing queries
- Fast feedback loop

### **2. Performance**
- Instant UI updates
- No loading spinners
- Full offline support
- Client-side computation
- Background sync

### **3. Type Safety**
- Database → Drizzle → Zod → TypeScript → React
- Single source of truth
- Refactoring is safe
- Fewer runtime errors

### **4. Security**
- Multi-layer authorization
- Row-level security
- Zod validation
- HTTPS/WSS encryption
- CSRF protection

### **5. Scalability**
- ElectricSQL horizontal scaling
- Client-side computation
- CDN for static assets
- Auto-scaling containers

---

## 📚 Documentation Sections

1. ✅ Executive Summary
2. ✅ Architectural Principles
3. ✅ System Overview
4. ✅ Bounded Contexts (4 contexts detailed)
5. ✅ Client-First Architecture
6. ✅ Functional Programming Structure
7. ✅ Local-First Data Architecture
8. ✅ Technology Stack
9. ✅ System Components
10. ✅ **Drizzle ORM Integration** (NEW!)
11. ✅ Data Models
12. ✅ Sync Engine Architecture
13. ✅ Security Architecture
14. ✅ Deployment Architecture
15. ✅ Development Roadmap

---

## 🎉 What Makes This Architecture Special

### **Single Source of Truth**
```typescript
// Define schema ONCE in Drizzle
export const projectsTable = pgTable('projects', { /* ... */ })

// Everything else auto-generates:
// ✅ PostgreSQL migrations
// ✅ Zod validation schemas
// ✅ TypeScript types
// ✅ TanStack DB collections
// ✅ tRPC input/output types
```

### **True Local-First**
- No spinners, ever
- Works 100% offline
- Real-time collaboration
- Automatic conflict resolution
- User owns their data

### **Functional + Type-Safe**
- Immutable data structures
- Pure functions
- Composition over inheritance
- Compile-time guarantees
- ADTs for domain modeling

---

## 📖 References

- [TanStack DB](https://tanstack.com/db/latest)
- [ElectricSQL](https://electric-sql.com/docs)
- [Drizzle ORM](https://orm.drizzle.team)
- [drizzle-zod](https://orm.drizzle.team/docs/zod)
- [TanStack Start](https://tanstack.com/start/latest)
- [Better Auth](https://www.better-auth.com/)
- [Electric + TanStack Starter](https://github.com/electric-sql/electric/tree/main/examples/tanstack-db-web-starter)

---

**Document Status:** ✅ Production Ready  
**Last Updated:** February 13, 2025  
**Architecture Team:** BuildInLime
