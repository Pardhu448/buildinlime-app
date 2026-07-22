# When is DDD Overkill? — BuildInLime Context

## The Two Types of "Business Logic"

### 1. Coordination Logic — Lives in the Backend
Things like:
- "Only team members can see this project"
- "A task can only be assigned to someone in the team"
- "Sending an email when a task is assigned"
- "Validating that a channel name is unique within a build unit"

These **must** live in the backend because they involve multiple actors. If User A and User B are both offline and both rename the same channel, the backend is the arbiter of who wins. Electric SQL syncs the resolution, but the rule itself has to be enforced somewhere authoritative.

### 2. State Transition Logic — Where the Client Has a Role

Things like:
- "Mark this task as complete"
- "Change status from In Progress → Done"
- "Add a comment to a channel"

In a **sync-first architecture** (Electric SQL), the client writes optimistically to the local SQLite store, and Electric propagates that state transition to other devices. The client is acting as a **peer**, not just a view. This is the CRDT/local-first philosophy — the client is a first-class participant in state transitions.

In this model, the client does own the transition logic — but it's still thin. "Mark complete" is just `{ completed: true }`. There's no complex rule being enforced, just a field being set.

---

## Where BuildInLime Actually Sits

The current stack — tRPC + Electric SQL — is a **hybrid**:

```
Client writes → tRPC mutation → backend validates + writes to Postgres
                                       ↓
                              Electric syncs to all clients
```

BuildInLime is **not** doing pure local-first (where the client writes to SQLite directly and syncs later). It writes through tRPC first, then Electric distributes the result. The backend is still the write authority.

| Concern | Owner |
|---|---|
| Validation rules | Backend (tRPC routers + Zod) |
| Access control | Backend (auth middleware) |
| State transitions | Initiated by client, committed by backend |
| UI state | Client only |

---

## What This Means for the Mobile App

The mobile app's "domain logic" is really just:

1. **Knowing the shape of data** — types and Zod validators → shared from `src/domain/`
2. **Knowing which tRPC call to make** — that's a use case, handled by a hook
3. **Knowing what to show** — presentation

There's no complex rule like "if priority is Critical and status is Overdue, then escalate" that needs to be enforced on the mobile client. That would live in the tRPC router.

---

## DDD on the Client Pays Off When...

If you moved to **true local-first** (client writes directly to SQLite, Electric syncs without going through tRPC), then the mobile app would own more domain logic — because it would be the write authority for its own local state. That's where DDD on the client becomes genuinely valuable.

Electric SQL is moving in this direction with its "write path" feature. When that lands fully, the architecture shifts and the client domain layer becomes much more important.

---

## Short Answer

Sync-based architecture does move logic toward the client — but BuildInLime's current stack (tRPC as the write path, Electric as read/sync) still centralises authority in the backend. The mobile app is a **smart reader and intent sender**, not a full peer.

**DDD on the client pays off when the client becomes the write authority — which is where Electric SQL is heading, but isn't where BuildInLime is today.**

### Practical Rule of Thumb

| Situation | DDD on Client? |
|---|---|
| tRPC as write path, Electric for sync | Not worth it |
| Pure local-first (client owns SQLite writes) | Yes — domain layer earns its keep |
| Complex client-side business rules (multi-step workflows, state machines) | Yes |
| Simple CRUD with field-level state transitions | No |
