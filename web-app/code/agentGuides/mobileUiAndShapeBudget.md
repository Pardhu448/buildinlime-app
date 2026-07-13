# Mobile UI: Final Screen Set & Shape Budget

Companion to `shapeConcurrencyAndLazySync.md`. That guide says the shape map is a
function of the screens, and to re-derive it once the UI is settled. This is that
re-derivation, plus the screen set it is derived from.

Derived 2026-07-12 against `mobile/ui/final-ui-optimized`.

---

## 1. Corrections to `shapeConcurrencyAndLazySync.md` §2

The shape map in that guide was written before the screens were read closely. Three
of its claims do not survive contact with the code, and all three are in our favour:

| Guide claims | Actually |
|---|---|
| `channels` is always-on — "nav, channel list" | The drawer does **not** list channels. `DrawerContent` calls only `useProjects()`. Channels are read by the build-unit screen and the channel screen — both inside the `[buildUnitId]` subtree. **Screen-scoped.** |
| `tasks` is read by "my-tasks + channel screen" | `tasksCollection` has exactly **one** reader: `my-tasks.tsx`. The channel screen does not touch it. |
| inbox/my-tasks are "*tabs* — one press away at all times" | They are **Drawer** screens (the `(tabs)` folder name is a leftover). Drawer screen mount lifecycle is configurable, so "must be always-on" was never forced by the navigator. |

The guide's conclusion that `messages`/`tasks` "cannot be made per-screen" was
therefore built on a false premise. They *could* have been screen-scoped, taking
the baseline to 3 shapes.

We end up somewhere better than either: `messages` **does** become screen-scoped, but
not by taking the badge away. A denormalized `mentions` shape (§3) feeds the Inbox and
its badge, which frees `messages` to be scoped to the channel screen — badge kept,
socket freed. Baseline lands at 5 (§4).

---

## 2. Final screen set

### Reachable today

```
Drawer
├── Home            index.tsx           project picker (no project) OR build-units grid
├── My Tasks        my-tasks.tsx        tasks assigned to me, whole project
├── Inbox           inbox.tsx           messages mentioning me, all channels
├── Offline Debug   offline-debug.tsx   __DEV__ only
└── Profile         profile.tsx         (drawer footer, not a nav item)

Stack (pushed from Home)
└── Build Unit      project/[projectId]/[buildUnitId]/index.tsx      channels + properties
    └── Channel     project/[projectId]/[buildUnitId]/[channelId].tsx  messages + resources + properties
```

### Dead / unreachable — to delete

| File | Why |
|---|---|
| `app/(tabs)/two.tsx` | Expo template scaffolding. Unreachable. |
| `app/modal.tsx` | Expo template scaffolding. Unreachable. |
| `app/(tabs)/projects/index.tsx` | Nothing routes to it. The drawer exposes no project switch. Take `projects/_layout.tsx` with it. |

### `project/[projectId]/index.tsx` — NOT dead. A live bug.

An earlier draft of this table listed it as a fourth dead file, "only reachable from
`projects/index.tsx` (itself unreachable)". **That is wrong — it is reachable, and
users hit it.** The build-unit screen's back button routes straight into it:

```ts
// [buildUnitId]/index.tsx:40
onPress={() => router.navigate(`/(tabs)/project/${projectId}` as any)}
```

So the live behaviour today is: Home renders the build-units grid → tap a build unit →
press back → you land on a **second, different** build-units grid, titled `"Build Units"`
instead of the project name, and with no drawer hamburger because it sits in the stack
rather than under the Drawer. Two screens render the same grid and back-navigation
silently swaps you onto the worse one.

It is still the right file to delete — Home already *is* the build-units grid, so this
one is a duplicate with no reason to exist. But the deletion is **not** a free removal of
dead code: **repoint the back button to Home (`/(tabs)`) first**, then delete the file
and drop `<Stack.Screen name="index" />` from `project/[projectId]/_layout.tsx`.
Delete it without that, and the back button breaks.

### Project switching: sign-out only, BY DESIGN

`DrawerContent` renders the active project read-only, and the code says why —
*"read-only — sign out to switch"*. **This is intentional, not a gap.** Do not
"fix" it by adding an in-session project switcher.

The data layer would technically support switching (the Phase 2 effect in
`(tabs)/_layout.tsx` re-runs `initProjectCollections` on any `projectId` change,
rebuilds the scoped collections, and rebinds the offline executor) — but a single
project per session keeps the whole scoped-collection lifecycle simple, and the
resync/executor-rebind path is the most fragile part of the app. Not exercising it
mid-session is worth more than the convenience.

**What the UI must do:** state the constraint instead of leaving the user to
discover it. Add a one-line note under the active-project badge in the drawer —
e.g. *"Sign out to switch project"* — so the badge reads as deliberately fixed
rather than as a button that does nothing.

This is also why `projects/index.tsx` is dead (§2 above): it exists to serve an
in-session switch flow that we are deliberately not shipping. Delete it.
(`project/[projectId]/index.tsx` goes too, but for a different reason — it is a
reachable duplicate of Home, not switch-flow scaffolding. See §2.)

---

## 3. The Inbox, and why it drives the whole budget

### Intent (settled 2026-07-13)

1. The Inbox **collates every message that mentions the user**, across all channels.
2. The **unread count is mentions the user has not yet opened.** Nothing else.

It is a mentions feed, not a general unread-messages feed. That distinction is the
single most load-bearing fact in this document — most of what follows only works
*because* the badge counts mentions rather than all messages.

### Why the Inbox is structurally the most expensive screen in the app

A useful mention row is:

> **Alice** mentioned you in **#foundation-pour** · Tower B · 2h ago
> *"…can you sign off on the @Partha rebar spec before Friday?"*

The `messages` row carries `createdby_id`, `channel_id`, `buildunit_id`,
`project_id` — **ids, not names.** Rendering "Alice" needs `users`; rendering
"#foundation-pour" needs `channels`.

The Inbox is a **cross-cutting** screen: it shows entities from everywhere, so it
needs every name-lookup collection live *at all times*. Built the naive way it drags
`users` and `channels` back to always-on, and combined with the two badges pinning
`messages` and `tasks`, the budget lands at **baseline 7 / peak 9** — i.e. the lazy-
shape project would have saved almost nothing versus today's 10.

(Today the screen dodges this by not rendering the context at all: `inbox.tsx:21`
hardcodes the channel label to the literal string `"Channel message"` and shows no
author. It is a stub.)

### Decision: a denormalized `mentions` shape

**Give the Inbox one purpose-built server-side shape** — filtered
`mention_ids @> [me]`, with **author name, channel name, and build-unit name
denormalized into the row** by the server.

The Inbox then reads exactly one small always-on shape and needs neither `users` nor
`channels`. That is what keeps the baseline at 5 — it converts the most expensive
screen in the app into the cheapest one.

Trade accepted: **renames go stale on existing rows.** A renamed channel will not
update the name baked into old mention rows unless they are refreshed. For a
mentions feed this is fine; do not extend the pattern to anything where a stale name
would mislead.

### Read-state: `read_by_ids` on `messages`

**Decision (2026-07-13): read-state is a new column on the `messages` table** —
`read_by_ids: string[]`, following the existing schema idiom (`mention_ids`,
`resource_ids`). The `mentions` shape exposes the derived `is_read` (`me = ANY
(read_by_ids)`), so the badge is a count over that one shape.

Rejected alternative: `last_read_at` on the membership row. It would have been a
per-(user, channel) cursor for zero new shapes, but read-state is a property of a
*message*, not of a membership, and hanging it off the membership table to save a
migration is the kind of unrelated-column shortcut that gets expensive later.

**Read semantics: a mention clears when its channel is opened** — not only when the
mention is tapped from the Inbox. Tap-through-only is simpler, but it lets the badge
show mentions the user has demonstrably already read, which destroys trust in the
number. Clearing on channel-open is the truthful one, and it is what a badge is for.

**On write-amplification (assessed and dismissed — do not re-litigate).** Read-state
on a *shared* message row means marking one read is a write to a row every channel
member syncs, so it fans out. This was investigated and is **not a problem here**,
for one reason: **only messages that mention the user ever get written.** Mentions of
any one person are rare, so opening a busy channel dirties one or two rows, not
fifty. Fan-out per write is a single row to whoever currently has that channel open.
Negligible.

⚠️ **This is precisely why the mentions-only intent matters.** If the Inbox ever
grows a general per-channel unread count ("Channel C has 12 new messages"), this
design collapses — you would dirty a row per message, and the correct model becomes a
per-`(user, channel)` cursor ("read up to timestamp T"), which is one row per channel
rather than one per message. A cursor does **not** belong on `messages`. Revisit this
whole section before adding any non-mention unread count.

---

## 4. Shape budget

**Decision (2026-07-12): the drawer shows live badges on Inbox and My Tasks.**

My Tasks needs nothing new — `Task` already has `completed` and `assignee_id`, so the
badge is `!completed && assignee_id === me`. Inbox is served by the `mentions` shape
above.

### `users` is NOT dead weight — correcting an earlier claim

An earlier draft of this doc (and `shapeConcurrencyAndLazySync.md` §2) called
`usersCollection` dead weight with zero readers, and recommended deleting it. **That
was wrong in an important way.** It has no readers because nobody ever wired it up —
and *two screens render placeholder garbage as a result*:

- `[channelId].tsx:54-62` builds a `usersMap` from message senders alone, labelling
  everyone else `User a1b2c3` — a truncated UUID — under the comment *"best-effort
  without a users collection"*.
- `inbox.tsx` shows no author at all.

So `users` is a **missing feature, not dead weight**. The channel screen genuinely
needs it to render message authors. The Inbox does not (the `mentions` shape carries
the author name denormalized), so `users` is **screen-scoped to the channel screen**.

`teams` remains genuinely dead as a *shape*: never read, only written via
`actions/teams.ts`, and registered with the offline executor. The collection
**object** must survive for writes; only its Electric shape goes. See the guide's
"Writes to a stopped collection" hazard — verify the sync layer self-starts on that
path rather than assuming it.

### Resulting budget

| Shape | Lifetime | Acquired at |
|---|---|---|
| `memberships` | always-on | boot — scope source of truth |
| `projects` | always-on | boot — `DrawerContent` is permanently mounted |
| `buildunits` | always-on | boot — Home |
| `tasks` | always-on | boot — **My Tasks badge** |
| **`mentions`** *(new)* | always-on | boot — **Inbox + its badge**. Small, denormalized. |
| `channels` | build-unit subtree | `project/[projectId]/[buildUnitId]/_layout.tsx` |
| `properties` | build-unit subtree | `project/[projectId]/[buildUnitId]/_layout.tsx` |
| `messages` | channel screen | `[channelId].tsx` — the Inbox no longer needs it |
| `resources` | channel screen | `[channelId].tsx` |
| `users` | channel screen | `[channelId].tsx` — message author names |
| `teams` | **never** — write-only | delete the shape, keep the collection object |

**Baseline 5. Peak 10** (channel screen open, inside a build-unit).

### Read the peak honestly

Peak is **not** an improvement on today's 10 — it is the same number. **The entire
win is in the baseline: 10 → 5.** That is the right thing to optimise, because
baseline is what every device holds open 24/7 and what the server pays for per *idle*
user, which is the cost that scales with your user count. Peak is transient — it
lasts only while someone is actively reading a channel — and the OkHttp cap is now 32
(§1 of `shapeConcurrencyAndLazySync.md`), so 10 concurrent is no longer near any
ceiling.

If peak ever needs trimming, the lever is denormalizing author names onto `messages`
the way `mentions` does, which would drop `users` entirely.

### ⚠️ Outstanding debt: the UI branch borrows against this budget

**Decided 2026-07-13.** The UI branch brings the mobile Inbox and My Tasks screens up to
parity with their web counterparts (`InboxPage.tsx`, `MyTasksPage.tsx`). Both web pages
are cross-cutting by construction — they render a `project › build unit › #channel`
breadcrumb per row, and the Inbox renders the message author — so the mobile screens now
read collections this table scopes away from always-on:

| Screen | Reads | §4 scopes it to | Cost |
|---|---|---|---|
| Inbox | `users`, `channels` | channel screen | +2 baseline |
| My Tasks | `channels` | build-unit subtree | (same `channels`) |
| Home (build-unit cards) | `properties` | build-unit subtree | +1 baseline |

**Baseline as built is therefore 8, not 5.** This is knowingly borrowed, not overlooked:
today every shape is always-on anyway (the registry does not exist), so nothing regresses
now — the debt only comes due when the registry lands.

**The repayment is denormalization, and it must happen in the `mentions` phase, before
the registry:**

- **Inbox** — free. The `mentions` shape (§3) already denormalizes author, channel and
  build-unit names into the row. Repointing the Inbox at it drops `users` *and* `channels`.
- **My Tasks** — needs a decision. Either denormalize `channel_name` onto `tasks` the same
  way, or drop `#channel` from its breadcrumb and keep only `project › build unit`
  (both always-on, so that costs nothing). Prefer the latter unless the channel name
  proves load-bearing — it is one more denormalized column to keep coherent.
- **Home's build-unit cards** — needs a decision too. Either denormalize a small property
  summary onto `buildunits`, or accept `properties` as always-on. Note `properties` is
  project-scoped and small, so this is the cheapest of the three to simply concede.

**Do not build the registry until these are repaid**, or it will be built against a
baseline of 8 and the 10 → 5 win is gone.

### ⚠️ The `buildunits` property columns are vestigial — do not trust them

`BuildUnit` in `@buildinlime/domain-types` carries `health`, `priority`, `task_name`,
`task_assignee`, `task_since`, `target_date` and `status_percent`. **Nothing writes any of
them.** There is no build-units action; `actions/properties.ts` is the only property
writer, and it writes the `properties` table. The columns are always null in practice.

Web's `BuildUnitCard` looks like it renders them, but it is rendering *defaults* —
`use-project-build-units.ts` does `bu.health ?? "On track"`, `bu.priority ?? "Low"`,
`bu.target_date ?? "—"`, `parseInt(bu.status_percent ?? "0")`. Every build unit on the web
grid therefore shows a hardcoded "On track / Low / 0%", not real data. **Do not copy that
pattern.** The mobile card reads real properties from `propertiesCollection` where
`entity === "buildUnit"`, which is what the build-unit detail screen already does — and
that is why Home now costs a `properties` shape.

Either wire the columns up or drop them from the schema; leaving them is a trap that has
already produced one screen of fabricated data.

### Acquire at layout boundaries, not per screen

`channels` and `properties` are read by the build-unit screen *and* the channel
screen. One acquire in the `[buildUnitId]` layout covers the whole subtree and
survives navigation between them — no churn on push/pop.

---

## 5. Inbox UI

Flat, reverse-chronological. This is a "what needs me" list; grouping by channel
makes the user scan containers to find items.

### Row anatomy

```
● Alice  ·  #foundation-pour  ·  Tower B  ·  2h
  "…can you sign off on the @Partha rebar spec before Friday?"
```

Every field comes from the denormalized `mentions` row — no joins on the client.

- **Unread dot** — bound to `is_read`. Today `inbox.tsx` renders `mentionDot`
  unconditionally on every row, so it signals nothing. It must mark unread *only*.
- **Read rows stay in the list, de-emphasised** (dot removed, text lightened). They
  do not disappear. The Inbox is a **record of mentions, not a queue to drain** — a
  mention you have read is still something you may need to find again.
- **Tapping a row** navigates to the message in its channel — which, per §3, is what
  clears it.

### Empty state

"No one has mentioned you yet." Distinguish it from the all-read state ("You're all
caught up") — they mean different things and a user who has never been mentioned
should not be told they are caught up.

---

## 6. Sequencing

The Inbox is no longer a pure-UI change — the `mentions` shape and `read_by_ids` are
server work. Split accordingly.

### This branch (`mobile/ui/final-ui-optimized`) — pure UI, no schema, no sync

1. Delete the three dead files (§2) — `two.tsx`, `modal.tsx`, `projects/` (index +
   layout) — and drop their `Drawer.Screen` / `Stack.Screen` registrations from
   `(tabs)/_layout.tsx` and `app/_layout.tsx`.
2. Retire the duplicate build-units grid (§2): repoint the build-unit back button to
   Home, **then** delete `project/[projectId]/index.tsx` and its `Stack.Screen`.
   Order matters — this one is reachable.
3. Drawer: add the *"Sign out to switch project"* note under the active-project
   badge (§2). Keep the badge read-only.
4. My Tasks badge — `!completed && assignee_id === me`. Needs nothing new.
   `useTasks(userId)` already filters by assignee; the badge is a `!completed` count
   over it. **No Inbox badge on this branch** — it needs the `mentions` shape.

5. Web parity for the screens (see the debt note in §4 — this is what borrows against
   the budget): drawer logo + lucide icons, bottom safe-area insets, web-style
   build-unit and channel cards, and Inbox / My Tasks rebuilt against `InboxPage.tsx`
   and `MyTasksPage.tsx`.

### Next: the `mentions` shape (schema + server)

6. `read_by_ids: string[]` on `messages` — migration.
7. `mentions` shape endpoint: filter `mention_ids @> [me]`, denormalize author /
   channel / build-unit names, expose derived `is_read`.
8. Mutation to mark a channel's mentions read on channel-open.
9. Rebuild `inbox.tsx` against it (§5), and add the Inbox badge.
10. **Repay the §4 debt** — repoint Inbox at `mentions` (drops `users` + `channels`),
    and settle My Tasks' `#channel` breadcrumb. Baseline must be back to 5 before the
    registry is built.

The `insertDataIntoDB` skill in `web-app/code/.claude/skills` covers the DB → tRPC →
Electric shape → collection path; follow it rather than improvising.

### Then: the shape registry

The refcounted registry from `shapeConcurrencyAndLazySync.md` §2, against the budget
in §4 above. Its hazards all still apply unchanged: restart the same instance rather
than rebuilding it, `resources` has no persistence so a stop/start is a full refetch,
and the resync path rebuilds instances so the registry must stay coherent with it.

Note this ordering is deliberate: **the registry lands last, because §4's budget is
only valid once the `mentions` shape exists.** Building the registry against today's
collections would scope `messages` and `users` wrongly.
