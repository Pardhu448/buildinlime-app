# Mobile lazy-load migration plan

Porting the web `web-mobile/infrastructure/lazy-loads` work (idle-GC of heavy
collections, seen-markers, tiny badge shapes) to the mobile app.

**Status:** ALL STEPS DONE (client-side). Steps 1–2 in commit b5b07aa
(properties + resources idle-GC; resources persisted). Steps 3–5 in commit
249b715 (seen_state replaces reads, inbox-mentions/my-tasks badge slices,
messages/tasks idle-GC). Not yet runtime-verified — see §7.

## TL;DR

- The **entire server side is already done**. Mobile hits the same server as web,
  so the `seen_state` table, the `seen` tRPC router, and the `/api/seen-state`,
  `/api/inbox-mentions`, `/api/my-tasks` shape routes web added already exist.
  **Mobile's work is purely client-side.**
- Mobile is at the *pre*-optimization state on all three axes: old per-item
  `reads`, full-collection badge scans, everything `NEVER_GC`.
- The phase order is **forced and identical to web**: the badge rework must land
  before the heavy collections can idle, because an always-mounted subscriber
  pins them today.
- One extra prerequisite web didn't have: **mobile `resources` is not persisted**,
  so it needs `persistedCollectionOptions` before idle-GC is cheap.

---

## 1. Subscriber audit — what pins what

Navigation: mobile uses an expo-router **Drawer** (`app/(tabs)/_layout.tsx`).
`DrawerContent` is the always-mounted equivalent of web's `<Sidebar>`.

| Collection | Persisted? | GC today | Always-mounted subscriber? | Can idle after rework? |
|---|---|---|---|---|
| projects, build_units, channels, users, teams, memberships, channel_members | yes | NEVER_GC | Drawer / spine | no — leave NEVER_GC |
| **messages** | yes | NEVER_GC | **yes — `DrawerContent → useReads` scans full collection** | yes, once badge pin removed |
| **tasks** | yes | NEVER_GC | **yes — same `useReads` scan** | yes, once badge pin removed |
| **properties** | yes | NEVER_GC | no (only channel/task screens) | **yes — can idle immediately** |
| **resources** | **NO** | NEVER_GC | no (only `ResourcesSheet`, mounted on open) | yes, *after* persistence added |
| reads | yes | NEVER_GC | yes (`useReads`) | replaced by seen_state |

**The pin:** `mobile-app/src/presentation/shared/hooks/useReads.ts` runs
`useLiveQuery(messagesCollection)` and `useLiveQuery(tasksCollection)` — full
scans — and `DrawerContent` calls it to render the My Tasks / Inbox badges. As
long as the Drawer is mounted (always), messages and tasks have a live query and
cannot GC. This is exactly the dependency web removed in `fb474e6`.

**`properties` is free right now** — nothing always-mounted subscribes to it
(only channel/build-unit/task screens). It can move to idle-GC independently of
the badge/seen work, as a low-risk first step.

---

## 2. seen_state migration shape (Phase A)

Web replaced the per-item `reads` collection (one row per user×item) with
`seen_state`: one timestamp marker per `(user, scope, scope_id)` — "seen up to
time T in this scope" — making unread an O(scopes) check instead of O(items).

**Server:** already migrated (web's drizzle `0007`, shared DB). Mobile does **not**
need a DB migration or any server change.

Client-side parity to build, mirroring the web files:

| Web file (template) | Mobile target |
|---|---|
| `application/collections/communication.ts` `_makeSeenStateCollection` | add to mobile `collections/communication.ts` (or `admin.ts`, where `reads` lives) |
| `application/actions/seen.ts` | new `application/actions/seen.ts` (optimistic upsert; keyed by `(user, scope, scope_id)`) |
| `presentation/hooks/use-seen.ts` | new `presentation/shared/hooks/useSeen.ts` |
| `routes/api/seen-state.ts` (server) | **none — reuse existing server route** |

Then delete mobile `actions/reads.ts`, `collections` `reads` entry, and
`useReads.ts`; repoint `MessageList`, `MessageItem`, `TasksSheet` at `useSeen`.

**Schema-version caveat (load-bearing):** every mobile collection shares one
`schemaVersion` (currently **3**) because the persistence adapter is cached by
that key — bumping one spawns a second adapter over the same SQLite file and
strands all collections (documented in `communication.ts:192`). Adding
`seen_state` / removing `reads` changes the collection set, so **bump every mobile
collection's `schemaVersion` together** (3 → 4).

---

## 3. Tiny badge shapes (Phase B)

Replace the full-collection scan in the Drawer badges with the two small
user-scoped shapes web added:

- `inbox_mentions` collection → `/api/inbox-mentions` (already on server)
- `my_tasks` collection → `/api/my-tasks` (already on server)

`DrawerContent`'s `UnreadBadge` reads counts from these tiny always-mounted
collections instead of scanning messages/tasks. **This is the step that removes
the pin** — after it, nothing always-mounted holds messages/tasks.

Keep `seen_state`, `inbox_mentions`, `my_tasks` at `NEVER_GC`: they *are* the
always-mounted subscription (tiny, user-scoped), exactly as on web.

---

## 4. Idle-GC the heavy collections (Phase C)

Introduce `IDLE_GC_MS = 60_000` in mobile `collections/_shared.ts` (mirror web),
then:

1. **properties → IDLE_GC_MS** — can be done first/independently (no pin).
2. **messages, tasks → IDLE_GC_MS** — only after Phase B removes the badge pin.
3. **resources:** first wrap `_makeResourcesCollection` in
   `persistedCollectionOptions` (it currently uses bare `electricCollectionOptions`
   — see `communication.ts:169`), *then* IDLE_GC_MS. Without persistence,
   resurrection refetches the whole shape rather than resuming from offset — the
   opposite of the intended win. **Done in step 2** — added at the shared
   `schemaVersion` 3 (NOT bumped 3→4: adding a collection at the *existing* shared
   version preserves the "all equal" adapter invariant, whereas a global bump would
   force an unnecessary full re-sync of every collection). resources has no
   always-mounted subscriber, so it was flipped to IDLE_GC_MS in the same step
   rather than deferred to phase C-final.

The resurrection mechanism (verified on web against `@tanstack/db@0.6.5`:
`addSubscriber → startSync` on a cleaned-up collection, resuming from the
persisted offset) is the same library on mobile, so the behavior transfers.

---

## 5. Mobile-specific tradeoffs & risks

- **Idle-GC is *more* valuable on mobile.** Closing idle shape long-polls saves
  battery and cellular data, not just server load. This argues for doing the full
  migration, not just the cheap subset.
- **App backgrounding.** When the OS suspends the app, GC timers and network
  pause. GC firing is best-effort cleanup, and correctness rests on
  resurrection-on-foreground, so backgrounding doesn't threaten correctness — but
  it's worth verifying a shape resumes cleanly after a long background period
  (token refresh / 401 retry path).
- **Flaky connections raise the resurrection cost**, which is exactly why
  persisting `resources` first (so resume is from-offset, not full-refetch) matters
  more on mobile than it did on web.
- **Mobile is still being finalized** (pending stashes). A collections migration
  touching every `schemaVersion` and the read model is broad; sequence it so each
  phase is independently shippable and verifiable, and coordinate with the
  finalization work to avoid a stash collision.
- **No automated tests** cover sync/offline on either app (ARCHITECTURE §12.7), so
  each phase needs a runtime verify pass on device/simulator.

---

## 6. Recommended phase order

1. **[DONE] Phase C-partial (properties → idle-GC).** Smallest, no dependencies,
   proves the `IDLE_GC_MS` mechanism on mobile.
2. **[DONE] Phase C-resources (persist + idle-GC).** Added
   `persistedCollectionOptions` to resources at the shared v3 (no global bump — see
   §4.3), and — since resources has no always-mounted subscriber — flipped it to
   IDLE_GC_MS in the same step. `messages`/`tasks` remain `NEVER_GC` (still pinned
   by the DrawerContent badge scan).
3. **Phase A (seen_state).** Replace `reads` with seen-markers, client-side only.
   Largest single step; carries the first real schema bump (adding seen_state /
   removing reads changes the collection set → bump every collection together).
4. **Phase B (badge shapes).** Repoint Drawer badges at `inbox_mentions` /
   `my_tasks`; delete the full-scan path. Removes the pin.
5. **Phase C-final (messages, tasks → idle-GC).** Now safe (resources already
   done in step 2). One commit + verify navigation resume.

Steps 1–2 are complete. Steps 3–5 are the larger, schema-touching migration.

## 7. Verification status

**VERIFIED ON DEVICE.** All steps (1–5) were built and verified on a physical
device by the author. This included the follow-up fix in commit 35f3baa
(mark-seen on blur via useFocusEffect rather than unmount) — the original
unmount-based marking left the drawer badges stale because the Drawer keeps
inbox/my-tasks mounted across navigation.

Commits on this branch:
- b5b07aa — steps 1–2 (properties + resources idle-GC; resources persisted)
- 249b715 — steps 3–5 (seen_state replaces reads; inbox-mentions/my-tasks badge
  slices; messages/tasks idle-GC)
- 35f3baa — badge-staleness fix (blur-based seen marking)
