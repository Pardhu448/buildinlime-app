# Upstream issue draft — TanStack/db

> Target repo: `TanStack/db` · relates to RFC #1659
> Package: `@tanstack/db-sqlite-persistence-core`
> Not yet filed — review and submit.

---

**Title:** Persisted collection strands a sync transaction whose `begin` lands during hydration but whose `commit` lands after the one-shot drain (ready + empty, silent)

**Labels:** bug, persistence, electric

---

## Summary

A persisted collection can finish initial load **`isReady()` / up-to-date but empty**, dropping rows the sync source actually delivered, when an Electric sync transaction **straddles the hydration boundary**: its `begin` fires while the collection is still hydrating from SQLite (so it's buffered), but its `commit` fires *after* the single post-hydration drain has already run. The buffered transaction is then never applied to the in-memory collection, never persisted, and the resume offset is never advanced.

This is in the same family as the "ready but empty and silent" defects catalogued in RFC #1659, but I don't see it among the 13 enumerated there — it's a transaction-ordering race at initial load rather than a resume/reset/routing issue. Filing separately per the RFC's structure; happy to fold it in if you'd prefer.

## Affected versions

Reproduced against `@tanstack/db-sqlite-persistence-core@0.1.9` (with `@tanstack/electric-db-collection@0.3.3`), on React Native / Expo (`expo-sqlite`). **The relevant code path is unchanged in the latest `0.2.8`** — the flag is still latched at `begin`, the drain still runs once at the end of `hydrateSubsetUnsafe`, and the queued-commit handler still returns without re-draining.

## Root cause

In `persisted.js`, the sync wrapper decides whether to withhold a sync transaction from the collection based on hydration state **latched at `begin`**:

```js
// begin interception
queuedBecauseHydrating: !runtime.isApplyingInternally() && runtime.isHydratingNow()
```

Buffered transactions are drained **exactly once**, at the tail of `hydrateSubsetUnsafe`:

```js
async hydrateSubsetUnsafe(options, config) {
  this.isHydrating = true;
  try {
    const rows = await this.loadSubsetRowsUnsafe(options); // <-- awaits SQLite
    this.applyRowsToCollection(rows);
  } finally {
    this.isHydrating = false;
  }
  await this.flushQueuedHydrationTransactionsUnsafe(); // <-- the ONE drain
  await this.flushQueuedTxCommittedUnsafe();
}
```

And the `commit` interception, for a transaction flagged at `begin`, just enqueues and returns:

```js
if (openTransaction.queuedBecauseHydrating) {
  runtime.queueHydrationBufferedTransaction({ /* ops... */ });
  return; // not applied, not persisted; nothing re-drains later
}
```

### The stranding interleaving

1. `hydrateSubsetUnsafe` sets `isHydrating = true` and `await`s `loadSubsetRowsUnsafe` (SQLite read).
2. The Electric shape response arrives: `begin` → **latched `queuedBecauseHydrating = true`** (still hydrating), row `write`s buffered.
3. Hydration's `await` resolves; `finally` sets `isHydrating = false`; **`flushQueuedHydrationTransactionsUnsafe()` runs — but the transaction is still open (no `commit` yet), so the queue is empty and the drain is a no-op.**
4. The shape's `up-to-date` arrives → `commit` → `queueHydrationBufferedTransaction(...)` (because the flag was latched `true` at step 2) → returns. **Nothing drains it again.**

The transaction sits in `queuedHydrationTransactions` forever. `electric-db-collection` has already `commit()`ed and called `markReady` (deferred behind `ensureStarted`, which resolved at step 3), so the collection reports **`isReady()` with `size 0`**. Because the buffered path also skips `persistAndBroadcastExternalSyncTransaction`, the rows are never written to SQLite and the offset is never advanced — so a full restart resumes from `-1` and *usually* re-fetches successfully, which is why the failure presents as "intermittent, fixed by a relaunch."

The common case is fine (hydration on an empty DB completes before the response, so `begin`/`commit` apply directly), which is why it's timing-dependent. It becomes likely under load — e.g. when ~13 persisted collections all start syncing at once and contend on one `SingleProcessCoordinator` / `applyMutex` plus a multi-MB WAL, delaying hydration enough that a fast network response straddles the boundary.

## Reproduction / evidence

Fresh sign-in on device, ~13 collections starting together. A representative failing collection (owner-side on-device logs, trimmed):

```
[net]  200 /api/buildunits offset=-1  → 1 data-row on the wire   (server delivered it)
[net]  200 /api/buildunits offset=0_0 → 0 data-rows (the up-to-date control message)
[rows] t+2s:  build_units=0  channels=0  channel_members=0   tasks=1  messages=85
[rows] t+5s:  build_units=0  channels=0  channel_members=0   tasks=1  messages=85
```

The victim set is random across logins (one run lost `channels` only; another lost `build_units + channels + channel_members` while `tasks`/`messages` applied), consistent with a race rather than a per-table fault. `collection.isReady()` is `true` for the empty collections; a relaunch (which resumes from `-1`, the offset never having advanced) restores them.

## Suggested fixes (any one)

1. **Re-drain after the hydration window closes.** After `isHydrating` flips to `false`, re-run `flushQueuedHydrationTransactionsUnsafe()` whenever a transaction is enqueued via the buffered-`commit` path (or have `queueHydrationBufferedTransaction` schedule a drain if hydration is no longer in progress).
2. **Latch `queuedBecauseHydrating` at `commit`, not `begin`.** Decide buffer-vs-apply when the transaction actually closes; by then `isHydrating` reflects reality.
3. **Guard the drain against the open-transaction window** — treat "a transaction opened during hydration is still open when the drain runs" as a reason to drain again on its commit.

Option 1 is the smallest change. Happy to open a PR with a regression test (fake driver whose `loadSubset` resolves *between* a shape's `begin` and `commit`) if that's useful.

## Notes

- Downstream we've shipped an app-level backstop (detect `isReady() && size === 0` for collections a membership scope proves must be non-empty, then rebuild them from `-1`), but that only covers collections with an external "must be non-empty" signal — the general fix has to live here.
