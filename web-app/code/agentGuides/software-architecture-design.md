# Software Architectural Design Document
## BuildInLime - Project Management Tool for Natural Builders

**Version:** 1.0  
**Date:** February 2025  
**Status:** Draft

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Architectural Principles](#architectural-principles)
3. [System Overview](#system-overview)
4. [Bounded Contexts](#bounded-contexts)
5. [Client-First Architecture](#client-first-architecture)
6. [Functional Programming Structure](#functional-programming-structure)
7. [Local-First Data Architecture](#local-first-data-architecture)
8. [Technology Stack](#technology-stack)
9. [System Components](#system-components)
10. [Data Models](#data-models)
11. [Sync Engine Architecture](#sync-engine-architecture)
12. [Security Architecture](#security-architecture)
13. [Deployment Architecture](#deployment-architecture)
14. [Development Roadmap](#development-roadmap)

---

## 1. Executive Summary

BuildInLime is a project management application designed for natural builders using eco-friendly construction methods and materials. The architecture follows Domain-Driven Design (DDD) with four bounded contexts, implements local-first principles for offline capability, and uses a client-first approach with minimal backend infrastructure.

### Key Architectural Decisions
- **Client-First**: Heavy computation and state management on client side
- **Local-First**: TanStack DB + ElectricSQL for local data and real-time sync
- **Functional Programming**: Immutable data structures, pure functions, compositional design
- **TypeScript**: Type-safe development across the entire stack
- **Sync Engine as Backend**: PostgreSQL + ElectricSQL replaces traditional API backend

---

## 2. Architectural Principles

### 2.1 Client-First Approach
- **Client Intelligence**: Business logic primarily resides on the client
- **Minimal Server**: Server just acts as a database with sync capabilities
- **Rich Client Experience**: Full application functionality available offline
- **Progressive Enhancement**: Server provides sync, backup, and collaboration

### 2.2 Functional Programming Principles
- **Immutability**: All data structures are immutable
- **Pure Functions**: Functions have no side effects, deterministic outputs
- **Composition**: Small, composable functions over large classes
- **Type Safety**: Leverage TypeScript's type system fully
- **Declarative Code**: Express what to do, not how to do it
- **Function-First**: Functions as first-class citizens

### 2.3 Local-First Software
- **No Spinners**: Immediate UI feedback, no network waits
- **Network Optional**: Full functionality without internet
- **Data Ownership**: Users control their data locally
- **Collaboration**: Seamless multi-device and multi-user sync
- **Longevity**: Data accessible even if service shuts down

### 2.4 Domain-Driven Design
- **Bounded Contexts**: Clear separation of business domains
- **Ubiquitous Language**: Shared vocabulary within each context
- **Context Mapping**: Well-defined integration between contexts
- **Anti-Corruption Layers**: Protect domain models from external changes

---

## 3. System Overview

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────┐              ┌────────────────┐        │
│  │  Web Client    │              │ Mobile Client  │        │
│  │  (React + TS)  │              │ (React Native) │        │
│  └────────────────┘              └────────────────┘        │
│          │                               │                  │
│          └───────────────┬───────────────┘                  │
│                          │                                  │
│         ┌────────────────▼────────────────┐                │
│         │    Client-Side Architecture     │                │
│         ├──────────────────────────────────┤                │
│         │  • Business Logic Layer         │                │
│         │  • TanStack DB (State)          │                │
│         │  • ElectricSQL Client           │                │
│         └────────────────┬────────────────┘                │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Network   │
                    └──────┬──────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Sync Infrastructure                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│         ┌────────────────────────────────┐                  │
│         │    ElectricSQL Sync Server     │                  │
│         │    (Handles Replication)       │                  │
│         └────────────────┬───────────────┘                  │
│                          │                                  │
│         ┌────────────────▼───────────────┐                  │
│         │    PostgreSQL Database          │                  │
│         │    (Central Source of Truth)   │                  │
│         └─────────────────────────────────┘                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Request Flow

**Traditional API Approach (NOT USED):**
```
Client → API Request → Backend Validation → Database → Response → Client Update
```

**Our Local-First Approach:**
```
Client → TanStack DB Collection Operation → Immediate UI Update
                              ↓
                    ElectricSQL Sync (background)
                              ↓
                    PostgreSQL Update
                              ↓
                    Replicate to Other Clients
```

---

## 4. Bounded Contexts

### 4.1 Context Overview

The application is divided into four bounded contexts based on business domain separation:

```
┌──────────────────────────────────────────────────────────────┐
│                        BuildInLime                            │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐         │
│  │    Admin    │  │Organization │  │ Comm-Channel │         │
│  │   Context   │  │   Context   │  │   Context    │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘         │
│         │                │                 │                  │
│         └────────────────┼─────────────────┘                  │
│                          │                                    │
│                   ┌──────▼──────┐                            │
│                   │ AI-Support  │                            │
│                   │   Context   │                            │
│                   └─────────────┘                            │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Admin Context

**Responsibility:** User identity, authentication, authorization, privacy, and security.

**Core Concepts:**
- User profiles and identity management
- Role-based access control (RBAC)
- Team and project membership
- Privacy settings and data portability
- Security and authentication

**Key Entities:**
```typescript
type User = {
  id: UserId;
  email: Email;
  profile: UserProfile;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type UserProfile = {
  displayName: string;
  avatarUrl: Option<URL>;
  bio: Option<string>;
  privacySettings: PrivacySettings;
};

type Role = 
  | { type: 'Owner' }
  | { type: 'Architect' }
  | { type: 'SiteSupervisor' }
  | { type: 'HeadMason' }
  | { type: 'TeamMember' };


type Membership = {
  userId: UserId;
  projectId: ProjectId;
  role: Role;
  permissions: Set<Permission>;
  addedAt: Timestamp;
};


```

**Example Queries:**
- What is my profile picture?
- What are all the projects I am involved in?
- Who can see my profile?
- Who are my teammates/project mates?
- How can I download all my personal data?

### 4.3 Organization Context

**Responsibility:** Project structure, build units, communication channels, and their relationships.

**Core Concepts:**
- Project hierarchy and organization
- BuildUnit lifecycle management
- Communication channel structure
- Resource allocation and tracking
- Property management across entities

**Key Entities:**
```typescript
type Project = {
  id: ProjectId;
  name: string;
  overview: string;
  properties: ProjectProperties;
  buildUnits: ReadonlyArray<BuildUnitId>;
  team: ReadonlyArray<Membership>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type BuildUnit = {
  id: BuildUnitId;
  projectId: ProjectId;
  name: string;
  overview: string;
  properties: BuildUnitProperties;
  channels: ReadonlyArray<CommChannelId>;
  members: ReadonlyArray<Membership>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type CommChannel = {
  id: CommChannelId;
  buildUnitId: BuildUnitId;
  domain: ChannelDomain;
  members: ReadonlyArray<UserId>;
  properties: ChannelProperties;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type ChannelDomain =
  | 'Requirements'
  | 'Design'
  | 'Finance'
  | 'Materials'
  | 'Experimentation'
  | 'Tools'
  | 'Execution';
```

### 4.4 Communication Channel Context

**Responsibility:** Chat-based communication, Task management, and collaboration.

**Core Concepts:**
- Domain-specific communication (Finance, Design, Execution, etc.)
- Multi-modal messaging (text, audio, image, video, documents)
- Task tracking and sign-offs
- Conversation threading and annotations
- Media management

**Key Entities:**
```typescript
type Message = {
  id: MessageId;
  channelId: CommChannelId;
  authorId: UserId;
  content: MessageContent;
  metadata: MessageMetadata;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type Task = {
  id: TaskId;
  channelId: CommChannelId;
  messageId: MessageId;
  name: string;
  type: TaskType;
  resources: <URL>;
  signOffs: ReadonlyArray<SignOff>;
  status: TaskStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```

### 4.5 AI-Support Context

**Responsibility:** AI-assisted features for summarization, data extraction, and intelligent assistance.

**Core Concepts:**
- Voice-to-text transcription
- Text/audio to structured data conversion
- Channel and build-unit summarization
- Image analysis for construction validation
- Natural language queries and insights

---

## 5. Client-First Architecture

### 5.1 Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                  Presentation Layer                      │
│  (React Components, UI, User Interactions)              │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│               Application Layer                          │
│  (TanStack DB Collections, Business Rules, Workflows)   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                 Domain Layer                            │
│  (Pure Business Logic, Domain Models, Types)            │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Infrastructure Layer                        │
│  (TanStack DB + ElectricSQL, Storage, External APIs)    │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Layer Responsibilities

#### Presentation Layer
- **Technology**: React 18+, TanStack Router, Tailwind
- **Responsibility**: 
  - Render UI components
  - Handle user interactions
  - Display data from TanStack DB live queries
  - Form validation and user feedback
- **Rules**:
  - No business logic
  - No direct database access
  - Pure components where possible

#### Application Layer
- **Technology**: TanStack DB Collections, TanStack Query, tRPC
- **Responsibility**:
  - Define TanStack DB collections with schemas
  - Orchestrate use cases and workflows via collection operations
  - Manage optimistic updates automatically
  - Coordinate between domain and infrastructure
  - Handle cross-cutting concerns (logging, analytics)
- **Rules**:
  - Use Electric for reads (via `useLiveQuery`)
  - Use collection operations for writes (optimistic + sync)
  - Use tRPC for server-side mutations (authorization layer)
  - No UI rendering logic

#### Domain Layer
- **Technology**: Pure TypeScript, fp-ts library
- **Responsibility**:
  - Define domain models and types
  - Implement pure business logic
  - Enforce business rules and invariants
  - Domain-specific calculations
- **Rules**:
  - No dependencies on other layers
  - Pure functions only
  - Framework-agnostic
  - Immutable data structures

#### Infrastructure Layer
- **Technology**: TanStack DB, ElectricSQL, IndexedDB
- **Responsibility**:
  - Configure TanStack DB with ElectricSQL sync
  - Define shape proxy routes for authentication
  - File storage and retrieval
  - External API integrations (AI, storage)
- **Rules**:
  - Implements interfaces defined by domain
  - Handles all I/O operations
  - Manages connection states and sync

### 5.3 Client-Side Module Structure

```
src/
├── domain/                    # Domain Layer (Pure Logic)
│   ├── admin/
│   │   ├── types.ts          # User, Role, Permission types
│   │   ├── validators.ts     # Email, password validation
│   │   └── rules.ts          # Business rules
│   ├── organization/
│   │   ├── types.ts          # Project, BuildUnit, Channel types
│   │   ├── validators.ts
│   │   └── rules.ts
│   ├── communication/
│   │   ├── types.ts          # Message, Artifact types
│   │   ├── validators.ts
│   │   └── rules.ts
│   ├── ai-support/
│   │   ├── types.ts
│   │   └── rules.ts
│   └── shared/
│       ├── types.ts          # Common types (Option, Result, etc.)
│       └── utils.ts          # Pure utility functions
│
├── application/               # Application Layer
│   ├── collections/          # TanStack DB Collections
│   │   ├── users.ts
│   │   ├── projects.ts
│   │   ├── buildUnits.ts
│   │   ├── channels.ts
│   │   ├── messages.ts
│   │   └── artifacts.ts
│   ├── hooks/                # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useProject.ts
│   │   └── useChannel.ts
│   ├── use-cases/            # Application workflows
│   │   ├── auth/
│   │   │   ├── signUp.ts
│   │   │   └── signIn.ts
│   │   ├── projects/
│   │   │   ├── createProject.ts
│   │   │   ├── addBuildUnit.ts
│   │   │   └── updateProjectProperties.ts
│   │   └── channels/
│   │       ├── sendMessage.ts
│   │       ├── createArtifact.ts
│   │       └── signOffArtifact.ts
│   └── services/             # Application services
│       ├── syncService.ts
│       ├── analyticsService.ts
│       └── notificationService.ts
│
├── infrastructure/            # Infrastructure Layer
│   ├── database/
│   │   ├── tanstack-db/      # TanStack DB setup
│   │   │   ├── client.ts
│   │   │   ├── collections.ts
│   │   │   └── schemas.ts
│   │   ├── electric/         # ElectricSQL setup
│   │   │   ├── client.ts
│   │   │   ├── shapes.ts
│   │   │   └── migrations/
│   │   └── schema.sql        # PostgreSQL schema
│   ├── storage/
│   │   ├── fileStorage.ts    # File uploads/downloads
│   │   └── mediaStorage.ts
│   ├── trpc/                 # tRPC setup
│   │   ├── client.ts
│   │   └── routers/
│   │       ├── projects.ts
│   │       ├── messages.ts
│   │       └── artifacts.ts
│   └── external/
│       ├── aiService.ts      # AI API integration
│       └── authProvider.ts   # OAuth integration
│
└── presentation/              # Presentation Layer
    ├── components/
    │   ├── admin/            # Admin context UI
    │   │   ├── UserProfile.tsx
    │   │   └── TeamManagement.tsx
    │   ├── organization/     # Organization context UI
    │   │   ├── ProjectList.tsx
    │   │   ├── BuildUnitCard.tsx
    │   │   └── ChannelList.tsx
    │   ├── communication/    # Communication context UI
    │   │   ├── ChatInterface.tsx
    │   │   ├── MessageItem.tsx
    │   │   └── ArtifactViewer.tsx
    │   ├── ai-support/       # AI context UI
    │   │   ├── SummaryPanel.tsx
    │   │   └── DataExtractor.tsx
    │   └── shared/           # Shared components
    │       ├── Button.tsx
    │       ├── Input.tsx
    │       └── Modal.tsx
    ├── pages/
    │   ├── Dashboard.tsx
    │   ├── ProjectView.tsx
    │   └── ChannelView.tsx
    └── App.tsx
```

---

## 6. Functional Programming Structure

### 6.1 Core Functional Principles

#### Immutability
All data structures are immutable. Updates create new versions.

```typescript
// ❌ Bad: Mutation
function addBuildUnit(project: Project, buildUnit: BuildUnit): void {
  project.buildUnits.push(buildUnit.id);
  project.updatedAt = new Date();
}

// ✅ Good: Immutable
function addBuildUnit(
  project: Project, 
  buildUnit: BuildUnit
): Project {
  return {
    ...project,
    buildUnits: [...project.buildUnits, buildUnit.id],
    updatedAt: new Date(),
  };
}
```

#### Pure Functions
Functions have no side effects and return consistent outputs.

```typescript
// ❌ Bad: Side effects
let projectCount = 0;
function createProject(name: string): Project {
  projectCount++; // Side effect
  console.log('Creating project'); // Side effect
  return { id: generateId(), name, buildUnits: [] };
}

// ✅ Good: Pure function
function createProject(
  id: ProjectId, 
  name: string, 
  timestamp: Timestamp
): Project {
  return {
    id,
    name,
    buildUnits: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
```

#### Composition
Build complex behavior from simple functions.

```typescript
import { pipe, flow } from 'fp-ts/function';
import * as A from 'fp-ts/Array';
import * as O from 'fp-ts/Option';

// Simple functions
const isCompleted = (buildUnit: BuildUnit): boolean =>
  buildUnit.properties.status.type === 'Completed';

const getEstimatedHours = (buildUnit: BuildUnit): Option<number> =>
  buildUnit.properties.estimatedManHours;

const sumHours = (hours: number[]): number =>
  hours.reduce((sum, h) => sum + h, 0);

// Composed function
const calculateTotalEstimatedHours = (
  buildUnits: ReadonlyArray<BuildUnit>
): Option<number> =>
  pipe(
    buildUnits,
    A.filter(isCompleted),
    A.map(getEstimatedHours),
    A.compact, // Remove None values
    (hours) => hours.length > 0 ? O.some(sumHours(hours)) : O.none
  );
```

### 6.2 Algebraic Data Types (ADTs)

Use discriminated unions for type-safe domain modeling.

```typescript
// Status as ADT
type BuildUnitStatus =
  | { type: 'NotStarted' }
  | { type: 'InProgress'; startedAt: Timestamp }
  | { type: 'Blocked'; reason: string; blockedAt: Timestamp }
  | { type: 'Completed'; completedAt: Timestamp };

// Pattern matching function
function getStatusLabel(status: BuildUnitStatus): string {
  switch (status.type) {
    case 'NotStarted':
      return 'Not Started';
    case 'InProgress':
      return `In Progress (since ${formatDate(status.startedAt)})`;
    case 'Blocked':
      return `Blocked: ${status.reason}`;
    case 'Completed':
      return `Completed on ${formatDate(status.completedAt)}`;
  }
}

// Result type for error handling
type Result<E, A> =
  | { type: 'Ok'; value: A }
  | { type: 'Error'; error: E };

// Option type for nullable values
type Option<A> =
  | { type: 'Some'; value: A }
  | { type: 'None' };
```

### 6.3 Functional Error Handling

Use `Result` and `Option` types instead of exceptions.

```typescript
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';

type ValidationError = {
  field: string;
  message: string;
};

// Validation function returning Either
function validateProjectName(
  name: string
): E.Either<ValidationError, string> {
  if (name.trim().length === 0) {
    return E.left({ field: 'name', message: 'Name cannot be empty' });
  }
  if (name.length > 100) {
    return E.left({ field: 'name', message: 'Name too long' });
  }
  return E.right(name.trim());
}

// Async operation returning TaskEither
function saveProject(
  project: Project
): TE.TaskEither<Error, Project> {
  return TE.tryCatch(
    () => projectCollection.insert(project),
    (reason) => new Error(String(reason))
  );
}

// Combining validations and async operations
function createAndSaveProject(
  name: string
): TE.TaskEither<ValidationError | Error, Project> {
  return pipe(
    validateProjectName(name),
    E.map((validName) => createProject(generateId(), validName, new Date())),
    TE.fromEither,
    TE.chain(saveProject),
  );
}
```

### 6.4 TanStack DB Collections with Functional Updates

```typescript
import { createCollection } from '@tanstack/db'
import { z } from 'zod'
import * as A from 'fp-ts/Array'
import { pipe } from 'fp-ts/function'

// Define schema with Zod
const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  overview: z.string().optional(),
  properties: z.object({
    timeline: z.object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }),
    status: z.enum(['Planning', 'Active', 'OnHold', 'Completed']),
  }),
  buildUnits: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date(),
})

type Project = z.infer<typeof projectSchema>

// Create collection
export const projectCollection = createCollection({
  name: 'projects',
  schema: projectSchema,
  
  // Optimistic insert
  onInsert: async ({ transaction }) => {
    const newProject = transaction.mutations[0].inserted
    
    // Call tRPC for server-side validation and persistence
    const result = await trpc.projects.create.mutate({
      name: newProject.name,
      overview: newProject.overview,
    })
    
    return { txid: result.txid }
  },
  
  // Optimistic update
  onUpdate: async ({ transaction }) => {
    const { original, modified } = transaction.mutations[0]
    
    const result = await trpc.projects.update.mutate({
      id: modified.id,
      data: {
        name: modified.name,
        properties: modified.properties,
      },
    })
    
    return { txid: result.txid }
  },
  
  // Optimistic delete
  onDelete: async ({ transaction }) => {
    const deletedProject = transaction.mutations[0].deleted
    
    const result = await trpc.projects.delete.mutate({
      id: deletedProject.id,
    })
    
    return { txid: result.txid }
  },
})

// Functional operations using the collection
export const projectOperations = {
  // Pure function to create project data
  createProjectData: (
    name: string,
    overview?: string
  ): Omit<Project, 'id' | 'createdAt' | 'updatedAt'> => ({
    name,
    overview,
    properties: {
      timeline: {},
      status: 'Planning',
    },
    buildUnits: [],
  }),

  // Optimistically insert
  insert: async (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    const project: Project = {
      ...projectData,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    
    await projectCollection.insert(project)
    return project
  },

  // Pure update function
  addBuildUnit: (project: Project, buildUnitId: string): Project => ({
    ...project,
    buildUnits: [...project.buildUnits, buildUnitId],
    updatedAt: new Date(),
  }),
}
```

### 6.5 Functional React Components with TanStack DB

```typescript
import { useLiveQuery, eq, and } from '@tanstack/react-db'
import { pipe } from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import * as A from 'fp-ts/Array'

// Pure render function
const renderBuildUnitStatus = (status: BuildUnitStatus): JSX.Element => (
  <span className={getStatusClassName(status)}>
    {getStatusLabel(status)}
  </span>
)

// Functional component with live query
const BuildUnitList: React.FC<{ projectId: ProjectId }> = ({ projectId }) => {
  // Live query with joins
  const { data: buildUnits } = useLiveQuery((q) =>
    q
      .from({ bu: buildUnitCollection })
      .where(({ bu }) => eq(bu.projectId, projectId))
      .select(({ bu }) => ({
        id: bu.id,
        name: bu.name,
        status: bu.properties.status,
        channels: bu.channels,
      }))
  )

  return (
    <div>
      <h2>Build Units</h2>
      {buildUnits.map((bu) => (
        <BuildUnitCard key={bu.id} buildUnit={bu} />
      ))}
    </div>
  )
}

// Component with cross-collection joins
const ChannelMessagesView: React.FC<{ channelId: CommChannelId }> = ({ 
  channelId 
}) => {
  // Live query joining messages with users
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
        authorAvatar: user.profile.avatarUrl,
        createdAt: msg.createdAt,
      }))
  )

  return (
    <div className="messages">
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
    </div>
  )
}

// Higher-order component for composition
const withLoading = <P extends object>(
  Component: React.FC<P>
): React.FC<P & { isLoading: boolean }> => 
  ({ isLoading, ...props }) =>
    isLoading ? <Spinner /> : <Component {...props as P} />

// Composed component
const BuildUnitListWithLoading = withLoading(BuildUnitList)
```

---

## 7. Local-First Data Architecture

### 7.1 Local-First Principles Implementation

#### No Spinners Principle
```typescript
// All writes are immediate via TanStack DB
async function sendMessage(
  channelId: CommChannelId,
  content: MessageContent
): Promise<Message> {
  const message: Message = {
    id: generateId(),
    channelId,
    authorId: currentUserId,
    content,
    metadata: defaultMetadata,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // Optimistic insert - UI updates immediately
  await messageCollection.insert(message)
  
  // Sync happens automatically in background via ElectricSQL
  // Collection's onInsert hook calls tRPC for authorization
  
  return message
}
```

#### Offline-First Operation
```typescript
// App works fully offline
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

// Component adapts to connectivity
const SyncIndicator: React.FC = () => {
  const isOnline = useOnlineStatus()
  const { data: syncStatus } = useLiveQuery((q) =>
    q.from({ sync: syncStatusCollection }).selectAll()
  )

  if (!isOnline) {
    return <Badge color="warning">Offline - {syncStatus?.pending || 0} pending</Badge>
  }

  if (syncStatus?.pending > 0) {
    return <Badge color="info">Syncing... {syncStatus.pending}</Badge>
  }

  return <Badge color="success">Synced</Badge>
}
```

### 7.2 TanStack DB + ElectricSQL Integration

#### Database Setup

```typescript
// infrastructure/database/tanstack-db/client.ts
import { createDatabase } from '@tanstack/db'
import { ElectricProvider } from '@electric-sql/client'

// Initialize ElectricSQL client
export const electric = new ElectricProvider({
  url: import.meta.env.VITE_ELECTRIC_URL,
})

// Create TanStack DB instance
export const db = createDatabase({
  name: 'buildinlime',
  collections: {
    users: userCollection,
    projects: projectCollection,
    buildUnits: buildUnitCollection,
    channels: channelCollection,
    messages: messageCollection,
    artifacts: artifactCollection,
  },
  
  // ElectricSQL as sync provider
  sync: {
    provider: electric,
    
    // Shape subscriptions per collection
    shapes: {
      users: {
        url: '/api/users',
        where: (userId: string) => `id = '${userId}'`,
      },
      projects: {
        url: '/api/projects',
        where: (userId: string) => `'${userId}' = ANY(user_ids)`,
      },
      messages: {
        url: '/api/messages',
        where: (channelId: string) => `channel_id = '${channelId}'`,
      },
    },
  },
})

// Initialize database
export async function initDatabase(userId: string) {
  await db.init()
  
  // Subscribe to user's data
  await db.sync.subscribe('users', userId)
  await db.sync.subscribe('projects', userId)
  
  return db
}
```

#### Collection Definitions

```typescript
// application/collections/projects.ts
import { createCollection } from '@tanstack/db'
import { z } from 'zod'
import { trpc } from '@/infrastructure/trpc/client'

export const projectCollection = createCollection({
  name: 'projects',
  
  schema: z.object({
    id: z.string(),
    name: z.string().min(1).max(100),
    overview: z.string().optional(),
    properties: z.object({
      timeline: z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }),
      location: z.object({
        latitude: z.number(),
        longitude: z.number(),
        address: z.string().optional(),
      }).optional(),
      status: z.enum(['Planning', 'Active', 'OnHold', 'Completed']),
    }),
    buildUnits: z.array(z.string()),
    user_ids: z.array(z.string()), // For RLS
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
  
  // Optimistic operations
  onInsert: async ({ transaction }) => {
    const { inserted: newProject } = transaction.mutations[0]
    
    // Server-side validation and authorization
    const result = await trpc.projects.create.mutate({
      name: newProject.name,
      overview: newProject.overview,
      properties: newProject.properties,
    })
    
    // Return transaction ID for sync tracking
    return { txid: result.txid }
  },
  
  onUpdate: async ({ transaction }) => {
    const { modified: updatedProject } = transaction.mutations[0]
    
    const result = await trpc.projects.update.mutate({
      id: updatedProject.id,
      data: {
        name: updatedProject.name,
        properties: updatedProject.properties,
      },
    })
    
    return { txid: result.txid }
  },
  
  onDelete: async ({ transaction }) => {
    const { deleted: project } = transaction.mutations[0]
    
    const result = await trpc.projects.delete.mutate({
      id: project.id,
    })
    
    return { txid: result.txid }
  },
})
```

### 7.3 PostgreSQL Schema

```sql
-- Admin Context Tables
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  privacy_settings JSONB NOT NULL DEFAULT '{"profileVisibility":"Team","dataAnalyticsConsent":false}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role JSONB NOT NULL, -- Serialized Role ADT
  permissions JSONB NOT NULL, -- Array of permissions
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);

-- Organization Context Tables
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  overview TEXT,
  properties JSONB NOT NULL,
  build_units JSONB NOT NULL DEFAULT '[]',
  user_ids TEXT[] NOT NULL, -- For RLS filtering
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE build_units (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  overview TEXT,
  properties JSONB NOT NULL,
  channels JSONB NOT NULL DEFAULT '[]',
  user_ids TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE comm_channels (
  id TEXT PRIMARY KEY,
  build_unit_id TEXT NOT NULL REFERENCES build_units(id) ON DELETE CASCADE,
  domain TEXT NOT NULL CHECK (domain IN (
    'Requirements', 'Design', 'Finance', 'Materials',
    'Experimentation', 'Tools', 'Execution'
  )),
  properties JSONB NOT NULL,
  user_ids TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Communication Context Tables
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES comm_channels(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  content_type TEXT NOT NULL,
  content JSONB NOT NULL,
  metadata JSONB NOT NULL,
  user_ids TEXT[] NOT NULL, -- Denormalized for RLS
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_channel_time ON messages(channel_id, created_at DESC);
CREATE INDEX idx_messages_user_ids ON messages USING GIN(user_ids);

CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES comm_channels(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL REFERENCES messages(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Draft', 'PendingReview', 'Approved', 'Rejected')),
  sign_offs JSONB NOT NULL DEFAULT '[]',
  user_ids TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI-Support Context Tables
CREATE TABLE ai_summaries (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('Channel', 'BuildUnit', 'Project')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL,
  user_ids TEXT[] NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE transcription_jobs (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id),
  audio_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Processing', 'Completed', 'Failed')),
  result TEXT,
  error_message TEXT,
  user_ids TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Enable ElectricSQL replication
ALTER TABLE users ENABLE ELECTRIC;
ALTER TABLE projects ENABLE ELECTRIC;
ALTER TABLE build_units ENABLE ELECTRIC;
ALTER TABLE comm_channels ENABLE ELECTRIC;
ALTER TABLE messages ENABLE ELECTRIC;
ALTER TABLE artifacts ENABLE ELECTRIC;
ALTER TABLE ai_summaries ENABLE ELECTRIC;
ALTER TABLE transcription_jobs ENABLE ELECTRIC;
```

### 7.4 Shape Proxy Routes for Authentication

```typescript
// Server-side shape proxy (TanStack Start route)
// routes/api/projects.ts

import { createAPIRoute } from '@tanstack/start'
import { auth } from '@/lib/auth'

export const Route = createAPIRoute({
  GET: async ({ request }) => {
    // 1. Validate session
    const session = await auth.api.getSession({ 
      headers: request.headers 
    })
    
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401 }
      )
    }

    // 2. Build Electric URL with row-level filtering
    const electricUrl = new URL(import.meta.env.ELECTRIC_URL)
    electricUrl.pathname = '/v1/shape'
    electricUrl.searchParams.set('table', 'projects')
    
    // Only sync projects where user has access
    const filter = `'${session.user.id}' = ANY(user_ids)`
    electricUrl.searchParams.set('where', filter)

    // 3. Proxy to Electric
    const response = await fetch(electricUrl.toString(), {
      headers: {
        ...Object.fromEntries(request.headers),
      },
    })

    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    })
  },
})
```

```typescript
// routes/api/messages.ts
export const Route = createAPIRoute({
  GET: async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401 
      })
    }

    const electricUrl = new URL(import.meta.env.ELECTRIC_URL)
    electricUrl.pathname = '/v1/shape'
    electricUrl.searchParams.set('table', 'messages')
    
    // Filter messages by channel access
    const filter = `'${session.user.id}' = ANY(user_ids)`
    electricUrl.searchParams.set('where', filter)

    const response = await fetch(electricUrl.toString(), {
      headers: Object.fromEntries(request.headers),
    })

    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    })
  },
})
```

### 7.5 Conflict Resolution

ElectricSQL uses CRDTs (Conflict-free Replicated Data Types) for automatic conflict resolution.

```typescript
// Most fields use Last-Write-Wins based on updated_at timestamp
// ElectricSQL handles this automatically

// For complex business logic, implement custom merge in collection hooks
export const buildUnitCollection = createCollection({
  name: 'build_units',
  schema: buildUnitSchema,
  
  // Custom conflict resolution
  onConflict: ({ local, remote }) => {
    // Business rule: Most progressed status wins
    const statusProgression = {
      'NotStarted': 0,
      'InProgress': 1,
      'Blocked': 1,
      'Completed': 2,
    }
    
    const localRank = statusProgression[local.properties.status.type]
    const remoteRank = statusProgression[remote.properties.status.type]
    
    return {
      ...remote,
      properties: {
        ...remote.properties,
        // Take most progressed status
        status: localRank >= remoteRank 
          ? local.properties.status 
          : remote.properties.status,
        // Take highest priority
        priority: Math.max(
          local.properties.priority, 
          remote.properties.priority
        ),
        // Prefer actual hours over estimated
        actualManHours: remote.properties.actualManHours || 
                       local.properties.actualManHours,
      },
    }
  },
})
```

---

## 8. Technology Stack

### 8.1 Frontend Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Core Framework** | React | 18.2+ | UI library |
| **Language** | TypeScript | 5.0+ | Type-safe development |
| **Build Tool** | Vite | 5.0+ | Fast development and builds |
| **Meta-framework** | TanStack Start | 1.0+ | Full-stack React framework |
| **Client Database** | TanStack DB | Latest | Embedded client database |
| **Sync Engine** | ElectricSQL | Latest | Local-first sync |
| **Data Fetching** | TanStack Query | 5.0+ | Server state management |
| **Routing** | TanStack Router | 1.0+ | Type-safe routing |
| **RPC** | tRPC | 10.0+ | End-to-end type-safe API |
| **ORM** | Drizzle ORM | Latest | Type-safe SQL ORM |
| **Schema Bridge** | drizzle-zod | Latest | Drizzle → Zod schema generation |
| **Form Management** | React Hook Form | 7.0+ | Performant forms |
| **Validation** | Zod | 3.22+ | Schema validation |
| **UI Components** | Material-UI | 5.0+ | Component library |
| **Styling** | Tailwind CSS | 3.0+ | Utility-first CSS |
| **Functional Programming** | fp-ts | 2.16+ | Functional utilities |
| **Date/Time** | date-fns | 2.30+ | Date utilities |
| **PWA Support** | Workbox | 7.0+ | Service workers |

### 8.2 Mobile Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Framework** | React Native | 0.73+ | Cross-platform mobile |
| **Language** | TypeScript | 5.0+ | Type-safe development |
| **Navigation** | React Navigation | 6.0+ | Navigation library |
| **Client Database** | TanStack DB | Latest | Embedded database |
| **Sync Engine** | ElectricSQL | Latest | Local-first sync |
| **Camera** | react-native-camera | Latest | Photo/video capture |
| **Audio** | react-native-audio-recorder-player | Latest | Voice recording |
| **File System** | react-native-fs | Latest | File management |

### 8.3 Backend Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Sync Server** | ElectricSQL Sync Service | Latest | Replication server |
| **Database** | PostgreSQL | 15+ | Central database |
| **Extensions** | PostGIS | 3.3+ | Geospatial data |
| **Authentication** | Better Auth | Latest | Session-based auth |
| **Object Storage** | Google Cloud Storage | Latest | File storage |
| **AI Services** | OpenAI API | Latest | GPT-4 for summaries |
| **Transcription** | OpenAI Whisper | Latest | Audio transcription |

### 8.4 Development Tools

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Package Manager** | pnpm | Fast, efficient package management |
| **Linting** | ESLint | Code quality |
| **Formatting** | Prettier | Code formatting |
| **Type Checking** | TypeScript | Static type checking |
| **Testing (Unit)** | Vitest | Fast unit tests |
| **Testing (E2E)** | Playwright | End-to-end testing |
| **CI/CD** | GitHub Actions | Automated workflows |
| **Monitoring** | Sentry | Error tracking |
| **Analytics** | PostHog | Product analytics |

---

## 9. System Components

### 9.1 Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        Client Layer                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Web Application (React)                   │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │                                                         │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │  │
│  │  │   Admin UI   │  │   Org UI     │  │  Comm UI    │ │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │  │
│  │         │                  │                  │        │  │
│  │  ┌──────▼──────────────────▼──────────────────▼──────┐ │  │
│  │  │        TanStack DB Collections (State)            │ │  │
│  │  └──────┬────────────────────────────────────────────┘ │  │
│  │         │                                               │  │
│  │  ┌──────▼────────────────────────────────────────────┐ │  │
│  │  │         Domain Logic (Pure Functions)             │ │  │
│  │  └──────┬────────────────────────────────────────────┘ │  │
│  │         │                                               │  │
│  │  ┌──────▼────────────────────────────────────────────┐ │  │
│  │  │      TanStack DB + ElectricSQL Client             │ │  │
│  │  └───────────────────────┬───────────────────────────┘ │  │
│  └────────────────────────────┼───────────────────────────┘  │
│                               │                               │
└───────────────────────────────┼───────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   HTTPS/WebSocket     │
                    └───────────┬───────────┘
                                │
┌───────────────────────────────▼───────────────────────────────┐
│                    Server Layer (TanStack Start)               │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              Shape Proxy Routes                          │ │
│  │  /api/projects, /api/messages, /api/artifacts           │ │
│  │  - Validate session                                      │ │
│  │  - Add WHERE user_id filter                             │ │
│  │  - Proxy to ElectricSQL                                 │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              tRPC Router                                 │ │
│  │  - Mutation authorization                                │ │
│  │  - Business logic validation                            │ │
│  │  - Return transaction IDs                               │ │
│  └─────────────────────┬────────────────────────────────────┘ │
│                        │                                       │
└────────────────────────┼───────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
┌───────────────┐                  ┌──────────────┐
│  ElectricSQL  │                  │  PostgreSQL  │
│  Sync Server  │◀────────────────▶│   Database   │
└───────────────┘                  └──────────────┘
```

### 9.2 Component Interactions

#### Message Creation Flow
```
User types message in Chat UI
         ↓
React Component calls messageCollection.insert()
         ↓
TanStack DB inserts to local collection (optimistic)
         ↓
UI updates immediately from live query
         ↓
Collection's onInsert hook calls tRPC for authorization
         ↓
tRPC validates and returns txid
         ↓
TanStack DB confirms transaction
         ↓
ElectricSQL syncs to PostgreSQL (background)
         ↓
PostgreSQL broadcasts change via logical replication
         ↓
ElectricSQL pushes to other clients' shape subscriptions
         ↓
Other clients' TanStack DB receives update
         ↓
Other clients' UIs update via live queries
```

#### Artifact Sign-Off Flow
```
User clicks "Sign Off" button
         ↓
signOffArtifact use-case executed
         ↓
Validates user has permission (domain rule)
         ↓
Creates SignOff domain object (pure function)
         ↓
artifactCollection.update() with new sign-off
         ↓
TanStack DB updates locally (optimistic)
         ↓
UI updates immediately
         ↓
Collection's onUpdate calls tRPC
         ↓
tRPC validates ownership and authorization
         ↓
tRPC checks if all required sign-offs complete
         ↓
If complete, trigger AI summary generation (async)
         ↓
ElectricSQL syncs to PostgreSQL
         ↓
Other team members receive updates
```

---

## 10. Drizzle ORM Integration

### 10.1 End-to-End Type Safety with Drizzle + Zod

BuildInLime uses **Drizzle ORM** with **drizzle-zod** to achieve complete type safety from database schema to client-side validation. This approach provides a single source of truth for data models.

```
┌─────────────────────────────────────────────────────────────┐
│          End-to-End Type Safety Flow                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. PostgreSQL Schema (Drizzle)                             │
│     ↓                                                        │
│  2. Drizzle Table Definitions (Type-Safe)                   │
│     ↓                                                        │
│  3. drizzle-zod Schemas (Auto-Generated)                    │
│     ↓                                                        │
│  4. TypeScript Types (Inferred from Zod)                    │
│     ↓                                                        │
│  5. TanStack DB Collections (Uses Zod Schemas)              │
│     ↓                                                        │
│  6. tRPC Procedures (Validated with Zod)                    │
│     ↓                                                        │
│  7. React Components (Type-Safe Queries)                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Database Schema with Drizzle

```typescript
// infrastructure/database/schema.ts
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  varchar,
  uuid,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod'
import { z } from 'zod'

// ==================== Admin Context Tables ====================

export const usersTable = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  privacySettings: jsonb('privacy_settings').$type<{
    profileVisibility: 'Public' | 'Team' | 'Private'
    dataAnalyticsConsent: boolean
  }>().notNull().default({
    profileVisibility: 'Team',
    dataAnalyticsConsent: false,
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const membershipsTable = pgTable('memberships', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => usersTable.id, { 
    onDelete: 'cascade' 
  }),
  projectId: text('project_id').notNull().references(() => projectsTable.id, { 
    onDelete: 'cascade' 
  }),
  role: jsonb('role').$type<{
    type: 'Owner' | 'Architect' | 'SiteSupervisor' | 'HeadMason' | 'TeamMember'
  }>().notNull(),
  permissions: text('permissions').array().notNull(),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
})

// ==================== Organization Context Tables ====================

export const projectsTable = pgTable('projects', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  overview: text('overview'),
  properties: jsonb('properties').$type<{
    timeline?: {
      startDate?: Date
      endDate?: Date
    }
    location?: {
      latitude: number
      longitude: number
      address?: string
    }
    status: 'Planning' | 'Active' | 'OnHold' | 'Completed'
    budget?: {
      estimated?: number
      actual?: number
      currency: string
    }
  }>().notNull(),
  buildUnits: text('build_units').array().notNull().default([]),
  userIds: text('user_ids').array().notNull().default([]), // For RLS
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const buildUnitsTable = pgTable('build_units', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projectsTable.id, {
    onDelete: 'cascade'
  }),
  name: varchar('name', { length: 100 }).notNull(),
  overview: text('overview'),
  properties: jsonb('properties').$type<{
    status: {
      type: 'NotStarted' | 'InProgress' | 'Blocked' | 'Completed'
      startedAt?: Date
      blockedAt?: Date
      reason?: string
      completedAt?: Date
    }
    priority: number
    estimatedManHours?: number
    actualManHours?: number
    materials?: Array<{
      name: string
      quantity: number
      unit: string
      cost?: number
    }>
  }>().notNull(),
  channels: text('channels').array().notNull().default([]),
  userIds: text('user_ids').array().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const commChannelsTable = pgTable('comm_channels', {
  id: text('id').primaryKey(),
  buildUnitId: text('build_unit_id').notNull().references(() => buildUnitsTable.id, {
    onDelete: 'cascade'
  }),
  domain: text('domain').notNull().$type<
    'Requirements' | 'Design' | 'Finance' | 'Materials' | 
    'Experimentation' | 'Tools' | 'Execution'
  >(),
  properties: jsonb('properties').$type<{
    description?: string
    isPinned: boolean
    muteNotifications: boolean
  }>().notNull().default({
    isPinned: false,
    muteNotifications: false,
  }),
  userIds: text('user_ids').array().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ==================== Communication Context Tables ====================

export const messagesTable = pgTable('messages', {
  id: text('id').primaryKey(),
  channelId: text('channel_id').notNull().references(() => commChannelsTable.id, {
    onDelete: 'cascade'
  }),
  authorId: text('author_id').notNull().references(() => usersTable.id),
  contentType: text('content_type').notNull().$type<
    'Text' | 'Image' | 'Video' | 'Audio' | 'Document'
  >(),
  content: jsonb('content').$type<{
    text?: string
    url?: string
    fileName?: string
    mimeType?: string
    duration?: number // for audio/video
    width?: number // for images/video
    height?: number
  }>().notNull(),
  metadata: jsonb('metadata').$type<{
    replyToId?: string
    mentions: string[]
    reactions: Array<{ userId: string; emoji: string }>
    isEdited: boolean
    editedAt?: Date
  }>().notNull().default({
    mentions: [],
    reactions: [],
    isEdited: false,
  }),
  userIds: text('user_ids').array().notNull().default([]), // Denormalized for RLS
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const artifactsTable = pgTable('artifacts', {
  id: text('id').primaryKey(),
  channelId: text('channel_id').notNull().references(() => commChannelsTable.id, {
    onDelete: 'cascade'
  }),
  messageId: text('message_id').notNull().references(() => messagesTable.id),
  name: varchar('name', { length: 255 }).notNull(),
  type: text('type').notNull().$type<
    'Blueprint' | 'Specification' | 'Photo' | 'Video' | 'Report' | 'Other'
  >(),
  url: text('url').notNull(),
  status: text('status').notNull().$type<
    'Draft' | 'PendingReview' | 'Approved' | 'Rejected'
  >().default('Draft'),
  signOffs: jsonb('sign_offs').$type<Array<{
    userId: string
    signedAt: Date
    comment?: string
  }>>().notNull().default([]),
  userIds: text('user_ids').array().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ==================== AI-Support Context Tables ====================

export const aiSummariesTable = pgTable('ai_summaries', {
  id: text('id').primaryKey(),
  targetId: text('target_id').notNull(),
  targetType: text('target_type').notNull().$type<'Channel' | 'BuildUnit' | 'Project'>(),
  content: text('content').notNull(),
  metadata: jsonb('metadata').$type<{
    model: string
    tokenCount: number
    sourceMessageCount: number
  }>().notNull(),
  userIds: text('user_ids').array().notNull().default([]),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  version: integer('version').notNull().default(1),
})

export const transcriptionJobsTable = pgTable('transcription_jobs', {
  id: text('id').primaryKey(),
  messageId: text('message_id').notNull().references(() => messagesTable.id),
  audioUrl: text('audio_url').notNull(),
  status: text('status').notNull().$type<
    'Pending' | 'Processing' | 'Completed' | 'Failed'
  >().default('Pending'),
  result: text('result'),
  errorMessage: text('error_message'),
  userIds: text('user_ids').array().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})

// ==================== Relations ====================

export const projectsRelations = relations(projectsTable, ({ many }) => ({
  buildUnits: many(buildUnitsTable),
  memberships: many(membershipsTable),
}))

export const buildUnitsRelations = relations(buildUnitsTable, ({ one, many }) => ({
  project: one(projectsTable, {
    fields: [buildUnitsTable.projectId],
    references: [projectsTable.id],
  }),
  channels: many(commChannelsTable),
}))

export const commChannelsRelations = relations(commChannelsTable, ({ one, many }) => ({
  buildUnit: one(buildUnitsTable, {
    fields: [commChannelsTable.buildUnitId],
    references: [buildUnitsTable.id],
  }),
  messages: many(messagesTable),
  artifacts: many(artifactsTable),
}))

export const messagesRelations = relations(messagesTable, ({ one }) => ({
  channel: one(commChannelsTable, {
    fields: [messagesTable.channelId],
    references: [commChannelsTable.id],
  }),
  author: one(usersTable, {
    fields: [messagesTable.authorId],
    references: [usersTable.id],
  }),
}))
```

### 10.3 Auto-Generated Zod Schemas with drizzle-zod

```typescript
// infrastructure/database/schemas.ts
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod'
import { z } from 'zod'
import * as tables from './schema'

// ==================== User Schemas ====================

export const selectUserSchema = createSelectSchema(tables.usersTable)
export const insertUserSchema = createInsertSchema(tables.usersTable, {
  email: z.string().email(),
  displayName: z.string().min(1).max(100),
}).omit({
  createdAt: true,
  updatedAt: true,
})
export const updateUserSchema = createUpdateSchema(tables.usersTable)

export type User = z.infer<typeof selectUserSchema>
export type InsertUser = z.infer<typeof insertUserSchema>
export type UpdateUser = z.infer<typeof updateUserSchema>

// ==================== Project Schemas ====================

export const selectProjectSchema = createSelectSchema(tables.projectsTable)
export const insertProjectSchema = createInsertSchema(tables.projectsTable, {
  name: z.string().min(1).max(100),
  overview: z.string().max(1000).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export const updateProjectSchema = createUpdateSchema(tables.projectsTable, {
  name: z.string().min(1).max(100).optional(),
})

export type Project = z.infer<typeof selectProjectSchema>
export type InsertProject = z.infer<typeof insertProjectSchema>
export type UpdateProject = z.infer<typeof updateProjectSchema>

// ==================== BuildUnit Schemas ====================

export const selectBuildUnitSchema = createSelectSchema(tables.buildUnitsTable)
export const insertBuildUnitSchema = createInsertSchema(tables.buildUnitsTable, {
  name: z.string().min(1).max(100),
  overview: z.string().max(1000).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export const updateBuildUnitSchema = createUpdateSchema(tables.buildUnitsTable)

export type BuildUnit = z.infer<typeof selectBuildUnitSchema>
export type InsertBuildUnit = z.infer<typeof insertBuildUnitSchema>
export type UpdateBuildUnit = z.infer<typeof updateBuildUnitSchema>

// ==================== CommChannel Schemas ====================

export const selectCommChannelSchema = createSelectSchema(tables.commChannelsTable)
export const insertCommChannelSchema = createInsertSchema(tables.commChannelsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export const updateCommChannelSchema = createUpdateSchema(tables.commChannelsTable)

export type CommChannel = z.infer<typeof selectCommChannelSchema>
export type InsertCommChannel = z.infer<typeof insertCommChannelSchema>
export type UpdateCommChannel = z.infer<typeof updateCommChannelSchema>

// ==================== Message Schemas ====================

export const selectMessageSchema = createSelectSchema(tables.messagesTable)
export const insertMessageSchema = createInsertSchema(tables.messagesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export const updateMessageSchema = createUpdateSchema(tables.messagesTable)

export type Message = z.infer<typeof selectMessageSchema>
export type InsertMessage = z.infer<typeof insertMessageSchema>
export type UpdateMessage = z.infer<typeof updateMessageSchema>

// ==================== Artifact Schemas ====================

export const selectArtifactSchema = createSelectSchema(tables.artifactsTable)
export const insertArtifactSchema = createInsertSchema(tables.artifactsTable, {
  name: z.string().min(1).max(255),
  url: z.string().url(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export const updateArtifactSchema = createUpdateSchema(tables.artifactsTable)

export type Artifact = z.infer<typeof selectArtifactSchema>
export type InsertArtifact = z.infer<typeof insertArtifactSchema>
export type UpdateArtifact = z.infer<typeof updateArtifactSchema>
```

### 10.4 TanStack DB Collections Using Drizzle Schemas

```typescript
// application/collections/projects.ts
import { createCollection } from '@tanstack/db'
import { selectProjectSchema, insertProjectSchema } from '@/infrastructure/database/schemas'
import { trpc } from '@/infrastructure/trpc/client'

export const projectCollection = createCollection({
  name: 'projects',
  
  // Use Zod schema auto-generated from Drizzle
  schema: selectProjectSchema,
  
  onInsert: async ({ transaction }) => {
    const { inserted: newProject } = transaction.mutations[0]
    
    // Validate with insert schema before sending to server
    const validatedData = insertProjectSchema.parse({
      name: newProject.name,
      overview: newProject.overview,
      properties: newProject.properties,
      buildUnits: newProject.buildUnits,
      userIds: newProject.userIds,
    })
    
    const result = await trpc.projects.create.mutate(validatedData)
    return { txid: result.txid }
  },
  
  onUpdate: async ({ transaction }) => {
    const { modified: updatedProject } = transaction.mutations[0]
    
    const result = await trpc.projects.update.mutate({
      id: updatedProject.id,
      data: {
        name: updatedProject.name,
        properties: updatedProject.properties,
      },
    })
    
    return { txid: result.txid }
  },
  
  onDelete: async ({ transaction }) => {
    const { deleted: project } = transaction.mutations[0]
    
    const result = await trpc.projects.delete.mutate({
      id: project.id,
    })
    
    return { txid: result.txid }
  },
})
```

### 10.5 tRPC Router with Drizzle ORM

```typescript
// infrastructure/trpc/routers/projects.ts
import { z } from 'zod'
import { router, authedProcedure } from '../trpc'
import { eq, and } from 'drizzle-orm'
import { projectsTable } from '@/infrastructure/database/schema'
import { 
  insertProjectSchema, 
  updateProjectSchema, 
  selectProjectSchema 
} from '@/infrastructure/database/schemas'

export const projectsRouter = router({
  // List projects for current user
  list: authedProcedure
    .output(z.array(selectProjectSchema))
    .query(async ({ ctx }) => {
      const projects = await ctx.db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.userIds, ctx.session.user.id))
      
      return projects
    }),

  // Get single project
  get: authedProcedure
    .input(z.object({ id: z.string() }))
    .output(selectProjectSchema.nullable())
    .query(async ({ ctx, input }) => {
      const [project] = await ctx.db
        .select()
        .from(projectsTable)
        .where(
          and(
            eq(projectsTable.id, input.id),
            eq(projectsTable.userIds, ctx.session.user.id)
          )
        )
      
      return project || null
    }),

  // Create project
  create: authedProcedure
    .input(insertProjectSchema)
    .output(z.object({ 
      txid: z.string(),
      project: selectProjectSchema 
    }))
    .mutation(async ({ ctx, input }) => {
      const projectId = generateId()
      const now = new Date()
      
      const [project] = await ctx.db
        .insert(projectsTable)
        .values({
          ...input,
          id: projectId,
          userIds: [ctx.session.user.id, ...(input.userIds || [])],
          createdAt: now,
          updatedAt: now,
        })
        .returning()
      
      return {
        txid: generateTxId(),
        project,
      }
    }),

  // Update project
  update: authedProcedure
    .input(z.object({
      id: z.string(),
      data: updateProjectSchema,
    }))
    .output(z.object({ 
      txid: z.string(),
      project: selectProjectSchema 
    }))
    .mutation(async ({ ctx, input }) => {
      // Check ownership
      const [existing] = await ctx.db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.id, input.id))
      
      if (!existing || !existing.userIds.includes(ctx.session.user.id)) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }
      
      const [project] = await ctx.db
        .update(projectsTable)
        .set({
          ...input.data,
          updatedAt: new Date(),
        })
        .where(eq(projectsTable.id, input.id))
        .returning()
      
      return {
        txid: generateTxId(),
        project,
      }
    }),

  // Delete project
  delete: authedProcedure
    .input(z.object({ id: z.string() }))
    .output(z.object({ txid: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check ownership
      const [existing] = await ctx.db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.id, input.id))
      
      if (!existing || !existing.userIds.includes(ctx.session.user.id)) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }
      
      await ctx.db
        .delete(projectsTable)
        .where(eq(projectsTable.id, input.id))
      
      return { txid: generateTxId() }
    }),
})
```

### 10.6 Drizzle Client Setup

```typescript
// infrastructure/database/drizzle.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Create PostgreSQL connection
const connectionString = process.env.DATABASE_URL!

const client = postgres(connectionString)

// Create Drizzle instance with schema
export const db = drizzle(client, { schema })

// Type-safe database instance
export type DbClient = typeof db
```

### 10.7 Type Safety Benefits

#### 1. **Schema Changes Propagate Automatically**
```typescript
// Change Drizzle schema:
export const projectsTable = pgTable('projects', {
  // Add new field
  archived: boolean('archived').notNull().default(false),
})

// drizzle-zod automatically updates:
// - insertProjectSchema
// - selectProjectSchema  
// - updateProjectSchema

// TypeScript errors appear in:
// - TanStack DB collections
// - tRPC procedures
// - React components
```

#### 2. **No Manual Type Duplication**
```typescript
// ❌ Without Drizzle + drizzle-zod (manual duplication)
type Project = {
  id: string
  name: string
  // ... 20 more fields
}

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  // ... duplicate all 20 fields
})

// ✅ With Drizzle + drizzle-zod (single source of truth)
export const projectsTable = pgTable('projects', { /* define once */ })
export const selectProjectSchema = createSelectSchema(projectsTable) // auto-generated
export type Project = z.infer<typeof selectProjectSchema> // auto-inferred
```

#### 3. **Database Constraints Reflected in Types**
```typescript
// Drizzle schema enforces constraints
export const usersTable = pgTable('users', {
  email: text('email').unique().notNull(),
  displayName: text('display_name').notNull(),
})

// Zod schema reflects constraints
const insertUserSchema = createInsertSchema(usersTable, {
  email: z.string().email(), // email validation
  displayName: z.string().min(1), // required
})

// TypeScript knows these are required
type InsertUser = {
  email: string // not optional
  displayName: string // not optional
}
```

### 10.8 Migration Workflow

```typescript
// 1. Update Drizzle schema
// infrastructure/database/schema.ts
export const projectsTable = pgTable('projects', {
  // ... existing fields
  newField: text('new_field'), // Add new field
})

// 2. Generate migration
// Terminal:
// $ pnpm drizzle-kit generate:pg

// 3. Apply migration
// $ pnpm drizzle-kit push:pg

// 4. drizzle-zod schemas update automatically
// 5. TypeScript errors appear where types don't match
// 6. Fix type errors in collections, tRPC, and components
// 7. Done! Full type safety maintained.
```

### 10.9 Complete Type Flow Example

```typescript
// 1. Drizzle defines schema
export const messagesTable = pgTable('messages', {
  id: text('id').primaryKey(),
  channelId: text('channel_id').notNull(),
  content: jsonb('content').notNull(),
})

// 2. drizzle-zod generates schemas
export const selectMessageSchema = createSelectSchema(messagesTable)
export const insertMessageSchema = createInsertSchema(messagesTable)

// 3. TypeScript infers types
export type Message = z.infer<typeof selectMessageSchema>
export type InsertMessage = z.infer<typeof insertMessageSchema>

// 4. TanStack DB collection uses schema
export const messageCollection = createCollection({
  schema: selectMessageSchema, // Type-safe!
})

// 5. tRPC validates with schema
export const messagesRouter = router({
  create: authedProcedure
    .input(insertMessageSchema) // Auto-validated!
    .mutation(async ({ input }) => {
      // input is type-safe Message
    })
})

// 6. React component is type-safe
const Chat: React.FC = () => {
  const { data: messages } = useLiveQuery<Message[]>(...)
  //      ^-- Fully typed!
}
```

---

## 11. Data Models

### 10.1 Core Type Definitions

#### Shared Types
```typescript
// domain/shared/types.ts

// Branded types for type safety
type Brand<K, T> = K & { __brand: T };

export type UserId = Brand<string, 'UserId'>;
export type ProjectId = Brand<string, 'ProjectId'>;
export type BuildUnitId = Brand<string, 'BuildUnitId'>;
export type CommChannelId = Brand<string, 'CommChannelId'>;
export type MessageId = Brand<string, 'MessageId'>;
export type ArtifactId = Brand<string, 'ArtifactId'>;

// Timestamp
export type Timestamp = Date;

// Email
export type Email = Brand<string, 'Email'>;

// URL
export type URL = Brand<string, 'URL'>;

// Result type
export type Result<E, A> =
  | { type: 'Ok'; value: A }
  | { type: 'Error'; error: E };

// Option type
export type Option<A> =
  | { type: 'Some'; value: A }
  | { type: 'None' };

// NonEmptyArray
export type NonEmptyArray<A> = [A, ...A[]];

// Utility functions
export const Some = <A>(value: A): Option<A> => ({ type: 'Some', value });
export const None: Option<never> = { type: 'None' };

export const Ok = <A>(value: A): Result<never, A> => ({ type: 'Ok', value });
export const Error = <E>(error: E): Result<E, never> => ({ type: 'Error', error });
```

#### Domain Models (Simplified - see full schema in domain/ folder)

```typescript
// domain/organization/types.ts
export type Project = {
  readonly id: ProjectId;
  readonly name: string;
  readonly overview: Option<string>;
  readonly properties: ProjectProperties;
  readonly buildUnits: ReadonlyArray<BuildUnitId>;
  readonly user_ids: ReadonlyArray<UserId>; // For RLS
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
};

export type BuildUnit = {
  readonly id: BuildUnitId;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly overview: Option<string>;
  readonly properties: BuildUnitProperties;
  readonly channels: ReadonlyArray<CommChannelId>;
  readonly user_ids: ReadonlyArray<UserId>;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
};

export type CommChannel = {
  readonly id: CommChannelId;
  readonly buildUnitId: BuildUnitId;
  readonly domain: ChannelDomain;
  readonly properties: ChannelProperties;
  readonly user_ids: ReadonlyArray<UserId>;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
};
```

---

## 11. Sync Engine Architecture

### 11.1 ElectricSQL + TanStack DB Sync Flow

```
┌───────────────────────────────────────────────────────────┐
│                    Client Device                          │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │         React Application Layer                      │ │
│  │  Uses useLiveQuery for reactive reads               │ │
│  └─────────────────────┬────────────────────────────────┘ │
│                        │                                   │
│  ┌─────────────────────▼────────────────────────────────┐ │
│  │         TanStack DB Collections                      │ │
│  │  • Type-safe schemas (Zod)                           │ │
│  │  • Optimistic mutations                              │ │
│  │  • Cross-collection joins                            │ │
│  │  • Live queries                                      │ │
│  └─────────────────────┬────────────────────────────────┘ │
│                        │                                   │
│  ┌─────────────────────▼────────────────────────────────┐ │
│  │         Local Storage Layer                          │ │
│  │  • IndexedDB (browser)                               │ │
│  │  • SQLite (React Native)                             │ │
│  └─────────────────────┬────────────────────────────────┘ │
│                        │                                   │
│  ┌─────────────────────▼────────────────────────────────┐ │
│  │         ElectricSQL Client                           │ │
│  │  • Shape subscriptions                               │ │
│  │  • WebSocket connection                              │ │
│  │  • Sync queue management                             │ │
│  └─────────────────────┬────────────────────────────────┘ │
│                        │                                   │
└────────────────────────┼───────────────────────────────────┘
                         │
                         │ WebSocket (WSS)
                         │
┌────────────────────────▼───────────────────────────────────┐
│                  Server (TanStack Start)                   │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │        Shape Proxy Routes (/api/*)                   │ │
│  │  1. Validate session cookie                          │ │
│  │  2. Add WHERE user_id = ? filter                     │ │
│  │  3. Proxy to ElectricSQL                             │ │
│  └────────────────────┬─────────────────────────────────┘ │
│                       │                                    │
│  ┌────────────────────▼─────────────────────────────────┐ │
│  │        tRPC Router                                   │ │
│  │  • Mutation authorization                            │ │
│  │  • Returns transaction IDs                           │ │
│  └────────────────────┬─────────────────────────────────┘ │
│                       │                                    │
└───────────────────────┼────────────────────────────────────┘
                        │
       ┌────────────────┴────────────────┐
       ▼                                 ▼
┌──────────────┐                  ┌──────────────┐
│ ElectricSQL  │                  │  PostgreSQL  │
│ Sync Service │◀────────────────▶│   Database   │
│              │  Logical         │   + PostGIS  │
│              │  Replication     │              │
└──────────────┘                  └──────────────┘
```

### 11.2 Shape-Based Sync with TanStack DB

```typescript
// infrastructure/database/tanstack-db/sync.ts
import { db } from './client'

// Subscribe to project data
export async function syncProjectData(
  projectId: ProjectId,
  userId: UserId
): Promise<void> {
  // Subscribe to shapes via authenticated proxy routes
  await Promise.all([
    // Projects shape
    db.sync.subscribe('projects', {
      url: '/api/projects',
      params: { projectId },
    }),
    
    // Build units for this project
    db.sync.subscribe('build_units', {
      url: '/api/build-units',
      params: { projectId },
    }),
    
    // Channels for this project
    db.sync.subscribe('channels', {
      url: '/api/channels',
      params: { projectId },
    }),
    
    // Recent messages (last 30 days)
    db.sync.subscribe('messages', {
      url: '/api/messages',
      params: { 
        projectId,
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    }),
  ])
}

// Unsubscribe when leaving project
export function unsyncProjectData(projectId: ProjectId): void {
  db.sync.unsubscribe('projects', projectId)
  db.sync.unsubscribe('build_units', projectId)
  db.sync.unsubscribe('channels', projectId)
  db.sync.unsubscribe('messages', projectId)
}
```

### 11.3 Live Queries with TanStack DB

```typescript
// Reactive queries automatically update when data changes
import { useLiveQuery, eq, and, desc } from '@tanstack/react-db'

// Simple query
const ProjectList: React.FC = () => {
  const { data: projects } = useLiveQuery((q) =>
    q
      .from({ p: projectCollection })
      .select(({ p }) => ({
        id: p.id,
        name: p.name,
        status: p.properties.status,
      }))
      .orderBy(({ p }) => desc(p.updatedAt))
  )

  return (
    <ul>
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </ul>
  )
}

// Join query
const ChannelMessagesView: React.FC<{ channelId: CommChannelId }> = ({
  channelId,
}) => {
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
        createdAt: msg.createdAt,
      }))
      .orderBy(({ msg }) => desc(msg.createdAt))
  )

  return (
    <div className="messages">
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
    </div>
  )
}
```

### 11.4 Optimistic Mutations

```typescript
// Collection operations are automatically optimistic
const CreateProjectButton: React.FC = () => {
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    
    try {
      // This updates UI immediately, syncs in background
      await projectCollection.insert({
        id: generateId(),
        name: 'New Project',
        overview: '',
        properties: {
          timeline: {},
          status: 'Planning',
        },
        buildUnits: [],
        user_ids: [currentUserId],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      
      // UI already updated via live query!
      // tRPC call happens in background (collection's onInsert hook)
    } catch (error) {
      // TanStack DB automatically rolls back on error
      console.error('Failed to create project:', error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Button onClick={handleCreate} disabled={isCreating}>
      Create Project
    </Button>
  )
}
```

---

## 12. Security Architecture

### 12.1 Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     Security Layers                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 1: Transport Security (HTTPS/WSS)                    │
│  ├─ TLS 1.3 encryption                                      │
│  ├─ Certificate pinning                                     │
│  └─ Secure WebSocket connections                            │
│                                                              │
│  Layer 2: Authentication (Better Auth)                      │
│  ├─ Session-based authentication                            │
│  ├─ OAuth 2.0 providers                                     │
│  ├─ HTTP-only session cookies                               │
│  └─ CSRF protection                                         │
│                                                              │
│  Layer 3: Authorization (Multi-layer)                       │
│  ├─ Shape Proxy: WHERE user_id filters                      │
│  ├─ tRPC: Ownership validation before mutations             │
│  ├─ PostgreSQL: Row-Level Security (RLS)                    │
│  └─ Client: Permission checks in UI                         │
│                                                              │
│  Layer 4: Data Protection                                   │
│  ├─ Encryption at rest (PostgreSQL)                         │
│  ├─ Encrypted backups                                       │
│  └─ Secure file storage (GCS)                               │
│                                                              │
│  Layer 5: Application Security                              │
│  ├─ Input validation (Zod schemas)                          │
│  ├─ XSS prevention                                          │
│  ├─ SQL injection prevention                                │
│  └─ Content Security Policy (CSP)                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 12.2 Authentication Flow

```typescript
// Using Better Auth for session management
import { betterAuth } from 'better-auth'
import { db } from '@/infrastructure/database'

export const auth = betterAuth({
  database: db,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
})

// Client-side session hook
export function useSession() {
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const response = await fetch('/api/auth/get-session', {
        credentials: 'include',
      })
      if (!response.ok) return null
      return response.json()
    },
  })

  return session
}
```

### 12.3 Row-Level Security in PostgreSQL

```sql
-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE comm_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Projects: Users can only see projects they're members of
CREATE POLICY user_project_access ON projects
  FOR SELECT
  USING (auth.user_id() = ANY(user_ids));

-- Projects: Only owners can delete
CREATE POLICY owner_delete_project ON projects
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.project_id = projects.id
        AND memberships.user_id = auth.user_id()
        AND memberships.role->>'type' = 'Owner'
    )
  );

-- Messages: Users can only see messages in channels they have access to
CREATE POLICY user_message_access ON messages
  FOR SELECT
  USING (auth.user_id() = ANY(user_ids));

-- Messages: Only channel members can insert
CREATE POLICY channel_member_send_message ON messages
  FOR INSERT
  WITH CHECK (
    auth.user_id() = ANY(user_ids) AND
    auth.user_id() = author_id
  );
```

### 12.4 tRPC Authorization

```typescript
// infrastructure/trpc/routers/artifacts.ts
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { authedProcedure } from '../procedures'

export const artifactsRouter = {
  signOff: authedProcedure
    .input(z.object({
      artifactId: z.string(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch the artifact
      const [artifact] = await ctx.db
        .select()
        .from(artifactsTable)
        .where(eq(artifactsTable.id, input.artifactId))

      if (!artifact) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      // 2. Check if user has access
      if (!artifact.user_ids.includes(ctx.session.user.id)) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      // 3. Check permission
      const [membership] = await ctx.db
        .select()
        .from(membershipsTable)
        .where(
          and(
            eq(membershipsTable.user_id, ctx.session.user.id),
            // Find project through channel -> build_unit -> project
          )
        )

      const permissions = membership.permissions as Permission[]
      if (!permissions.includes('SignOffArtifact')) {
        throw new TRPCError({ 
          code: 'FORBIDDEN',
          message: 'You do not have permission to sign off artifacts',
        })
      }

      // 4. Add sign-off
      const signOff = {
        userId: ctx.session.user.id,
        signedAt: new Date(),
        comment: input.comment,
      }

      const updatedSignOffs = [...artifact.sign_offs, signOff]

      // 5. Update artifact
      await ctx.db
        .update(artifactsTable)
        .set({
          sign_offs: updatedSignOffs,
          updated_at: new Date(),
        })
        .where(eq(artifactsTable.id, input.artifactId))

      // 6. Return transaction ID for sync
      return {
        txid: generateTxId(),
        signOff,
      }
    }),
}
```

---

## 13. Deployment Architecture

### 13.1 Deployment Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     Cloud Infrastructure                      │
│                   (Google Cloud Platform)                     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                  Cloud CDN                             │  │
│  │  • Static assets (JS, CSS, images)                    │  │
│  │  • Global edge caching                                │  │
│  │  • HTTPS termination                                  │  │
│  └───────────────────┬────────────────────────────────────┘  │
│                      │                                        │
│  ┌───────────────────▼────────────────────────────────────┐  │
│  │              Cloud Storage                             │  │
│  │  • TanStack Start static build                        │  │
│  │  • User uploaded files (images, videos, docs)         │  │
│  │  • Backups                                            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Cloud Run (Containers)                    │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │   TanStack Start Server                          │ │  │
│  │  │   • Shape proxy routes                           │ │  │
│  │  │   • tRPC API                                     │ │  │
│  │  │   • Better Auth                                  │ │  │
│  │  │   • Auto-scaling (0-N instances)                 │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  │                                                         │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │   ElectricSQL Sync Service                       │ │  │
│  │  │   • WebSocket server                             │ │  │
│  │  │   • Change Data Capture                          │ │  │
│  │  │   • Auto-scaling                                 │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └─────────────────────┬──────────────────────────────────┘  │
│                        │                                      │
│  ┌─────────────────────▼──────────────────────────────────┐  │
│  │           Cloud SQL (PostgreSQL)                       │  │
│  │  • High availability (regional)                        │  │
│  │  • Automated backups                                  │  │
│  │  • Point-in-time recovery                            │  │
│  │  • Logical replication enabled                       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Cloud Functions                           │  │
│  │  • Image processing                                   │  │
│  │  • Video transcoding                                  │  │
│  │  • AI processing (OpenAI integration)                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 13.2 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy BuildInLime

on:
  push:
    branches: [main, staging, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
          
      - name: Install dependencies
        run: pnpm install
        
      - name: Type check
        run: pnpm type-check
        
      - name: Lint
        run: pnpm lint
        
      - name: Test
        run: pnpm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        
      - name: Install dependencies
        run: pnpm install
        
      - name: Build
        run: pnpm build
        env:
          VITE_ELECTRIC_URL: ${{ secrets.ELECTRIC_URL }}
          
      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: .output/

  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Download artifacts
        uses: actions/download-artifact@v3
        with:
          name: dist
          path: .output/
          
      - name: Deploy TanStack Start to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v1
        with:
          service: buildinlime-app
          image: gcr.io/${{ secrets.GCP_PROJECT }}/buildinlime:${{ github.sha }}
          region: us-central1
          credentials: ${{ secrets.GCP_SA_KEY }}

  deploy-electric:
    if: github.ref == 'refs/heads/main'
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy ElectricSQL to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v1
        with:
          service: electric-sync
          image: electricsql/electric:latest
          region: us-central1
          env_vars: |
            DATABASE_URL=${{ secrets.DATABASE_URL }}
            ELECTRIC_WRITE_TO_PG_MODE=logical_replication
          credentials: ${{ secrets.GCP_SA_KEY }}
```

---

## 14. Development Roadmap

### 14.1 Phase 1: Foundation (Weeks 1-3)

**Goal**: Core infrastructure with TanStack DB + ElectricSQL

#### Week 1: Project Setup
- [ ] Initialize TanStack Start project
- [ ] Configure TypeScript with strict mode
- [ ] Setup TanStack DB with collections
- [ ] Configure ESLint, Prettier
- [ ] Setup Vitest for testing
- [ ] Initialize Git repository and CI/CD

#### Week 2: Database and Sync
- [ ] Setup PostgreSQL with PostGIS
- [ ] Create database schema (Admin context)
- [ ] Setup ElectricSQL sync service
- [ ] Configure TanStack DB + Electric integration
- [ ] Create shape proxy routes
- [ ] Test local-first sync with simple CRUD

#### Week 3: Authentication
- [ ] Integrate Better Auth
- [ ] Implement OAuth flows (Google, Email)
- [ ] Create User profile management
- [ ] Setup Row-Level Security policies
- [ ] Implement permission system in tRPC

**Deliverable**: Working authentication with local-first user profiles

### 14.2 Phase 2: Organization Context (Weeks 4-6)

**Goal**: Project and BuildUnit management with TanStack DB

#### Week 4: Project Management
- [ ] Define Project collection with Zod schema
- [ ] Create Project CRUD via collection operations
- [ ] Build Project list with useLiveQuery
- [ ] Add team management features
- [ ] Implement tRPC mutations for authorization

#### Week 5: BuildUnit Management
- [ ] Define BuildUnit collection
- [ ] Create BuildUnit CRUD operations
- [ ] Build BuildUnit UI with live queries
- [ ] Add BuildUnit-Project relationships
- [ ] Implement BuildUnit properties

#### Week 6: Communication Channels
- [ ] Define CommChannel collection
- [ ] Create channel CRUD operations
- [ ] Build channel list with joins
- [ ] Add channel-BuildUnit relationship
- [ ] Implement channel member management

**Deliverable**: Full project organization with optimistic updates

### 14.3 Phase 3: Communication Features (Weeks 7-9)

**Goal**: Chat and artifact management

#### Week 7: Basic Chat
- [ ] Define Message collection
- [ ] Create message pagination with live queries
- [ ] Build chat interface component
- [ ] Add real-time message updates
- [ ] Implement message threading

#### Week 8: Rich Media
- [ ] Setup file upload to Cloud Storage
- [ ] Implement image messages
- [ ] Add video message support
- [ ] Create audio message recording
- [ ] Build document attachment system

#### Week 9: Artifacts
- [ ] Define Artifact collection
- [ ] Create artifact creation flow
- [ ] Build sign-off system with tRPC
- [ ] Add artifact status tracking
- [ ] Create artifact viewer

**Deliverable**: Fully functional chat with media and artifacts

### 14.4 Phase 4: Mobile Application (Weeks 10-12)

**Goal**: React Native with TanStack DB

#### Week 10: Mobile Setup
- [ ] Initialize React Native project
- [ ] Setup TanStack DB for React Native
- [ ] Configure React Navigation
- [ ] Setup ElectricSQL for mobile
- [ ] Implement authentication flow

#### Week 11: Core Mobile Features
- [ ] Build project/BuildUnit navigation
- [ ] Create channel chat interface
- [ ] Implement camera integration
- [ ] Add voice recording
- [ ] Build offline indicator

#### Week 12: Mobile Polish
- [ ] Optimize performance
- [ ] Add push notifications
- [ ] Implement background sync
- [ ] Create app icons and splash screens
- [ ] Test on iOS and Android

**Deliverable**: Production-ready mobile app

### 14.5 Phase 5: AI Integration (Weeks 13-15)

**Goal**: AI-powered features

#### Week 13: Transcription
- [ ] Setup OpenAI Whisper API
- [ ] Create transcription job collection
- [ ] Implement background job processor
- [ ] Add transcript display in UI
- [ ] Handle transcription errors

#### Week 14: Data Extraction
- [ ] Implement GPT-4 based extraction
- [ ] Create extraction job types
- [ ] Build structured data display
- [ ] Add manual correction UI
- [ ] Test extraction accuracy

#### Week 15: Summarization
- [ ] Define AISummary collection
- [ ] Implement channel summarization
- [ ] Create BuildUnit summaries
- [ ] Build project-level summaries
- [ ] Create summary viewer UI

**Deliverable**: AI assistant with summarization and extraction

### 14.6 Phase 6: Polish and Launch (Weeks 16-18)

**Goal**: Production readiness

#### Week 16: Performance
- [ ] Optimize TanStack Start bundle size
- [ ] Implement code splitting
- [ ] Add lazy loading for collections
- [ ] Optimize images
- [ ] Setup CDN

#### Week 17: Testing
- [ ] Write comprehensive unit tests
- [ ] Create integration tests
- [ ] Perform E2E testing with Playwright
- [ ] Conduct security audit
- [ ] Fix critical bugs

#### Week 18: Launch Preparation
- [ ] Create user documentation
- [ ] Build onboarding flow
- [ ] Setup monitoring (Sentry)
- [ ] Conduct beta testing
- [ ] Deploy to production

**Deliverable**: Production-ready application

---

## Appendix

### A. Glossary

- **BuildUnit**: Physically and logistically independent construction unit
- **CommChannel**: Domain-specific communication channel (chat)
- **Artifact**: Important document/media requiring sign-off
- **CRDT**: Conflict-free Replicated Data Type
- **Local-First**: Architecture prioritizing local data and offline functionality
- **Shape**: ElectricSQL's subscription mechanism for selective sync
- **Shape Proxy**: Server route that authenticates and filters Electric shapes
- **Collection**: TanStack DB's type-safe data container with schema
- **Live Query**: Reactive query that automatically updates on data changes
- **Optimistic Update**: UI update before server confirmation

### B. References

- [TanStack DB Documentation](https://tanstack.com/db/latest)
- [ElectricSQL Documentation](https://electric-sql.com/docs)
- [TanStack Start Documentation](https://tanstack.com/start/latest)
- [ElectricSQL + TanStack DB Starter](https://github.com/electric-sql/electric/tree/main/examples/tanstack-db-web-starter)
- [Local-First Software](https://www.inkandswitch.com/local-first/)
- [Domain-Driven Design](https://www.domainlanguage.com/ddd/)
- [fp-ts Documentation](https://gcanti.github.io/fp-ts/)
- [Better Auth Documentation](https://www.better-auth.com/)

### C. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-02 | Use TanStack DB for state | Perfect match with ElectricSQL, type-safe, reactive |
| 2025-02 | ElectricSQL for sync | Best local-first solution for PostgreSQL |
| 2025-02 | TanStack Start meta-framework | Unified full-stack React with built-in API routes |
| 2025-02 | Drizzle ORM for database | Type-safe SQL, better PostgreSQL support than Prisma |
| 2025-02 | drizzle-zod for schema bridge | Auto-generate Zod schemas from Drizzle tables |
| 2025-02 | TypeScript instead of JavaScript | Type safety essential for complex domain |
| 2025-02 | Better Auth for sessions | Simple, session-based, works with cookies |
| 2025-02 | tRPC for mutations | End-to-end type safety for authorization layer |
| 2025-02 | Material-UI for components | Comprehensive, accessible, well-maintained |
| 2025-02 | Google Cloud over AWS | Better pricing for our use case |
| 2025-02 | pnpm over npm/yarn | Faster, more efficient |

### D. Key Architecture Benefits

#### **1. Complete Type Safety**
```
Drizzle Schema → drizzle-zod → Zod Schemas → TypeScript Types → React Components
```
- Single source of truth for all data models
- Compile-time errors for schema mismatches
- No manual type duplication

#### **2. Local-First Performance**
- Instant UI updates (no loading spinners)
- Full offline functionality
- Automatic conflict resolution
- Background synchronization

#### **3. Developer Experience**
- Hot module reloading with Vite
- Type-safe database queries with Drizzle
- Type-safe API with tRPC
- Automatic schema validation with Zod
- Live queries that auto-update UI

#### **4. Scalability**
- Horizontal scaling via ElectricSQL
- Client-side computation reduces server load
- CDN for static assets
- Auto-scaling Cloud Run containers

#### **5. Security Layers**
- Transport: HTTPS/WSS with TLS 1.3
- Authentication: Session-based with Better Auth
- Authorization: Shape Proxy + tRPC + PostgreSQL RLS
- Data Protection: Encryption at rest and in transit
- Application: Zod validation, XSS prevention, CSP

---

**Document Control**

- **Author**: Architecture Team
- **Reviewers**: Engineering Team, Product Team
- **Last Updated**: February 2025
- **Next Review**: March 2025
- **Version**: 1.0

**Change History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-02 | Architecture Team | Initial draft with TanStack DB |

