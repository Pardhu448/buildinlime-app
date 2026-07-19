# Object-Storage Migration Plan — BuildInLime

Closes **ARCHITECTURE.md §12.1** — *"File storage is the local filesystem
(`uploads/resources/`). This pins the backend to a single machine — it cannot be
horizontally scaled or serverless-deployed without moving to object storage."*

This is the **#1 blocker to any production deploy** (see
`testingAndCiSetup.md` §Phase 6): as long as bytes live on the app server's local
disk, the backend cannot be run as more than one instance and cannot go serverless.

Drafted 2026-07-19 against `main`. Section refs like **§8** point at
`ARCHITECTURE.md` at the repo root.

**Target: GCP** — the app on a **GCE VM** (Compute Engine), bytes in **Google Cloud
Storage** (via `@google-cloud/storage`, ADC from the VM's attached service account).
**Status (2026-07-19): §9 steps 1–3 BUILT** — the provider seam, the local + GCS
drivers, the shared conformance suite, the purge-script port, and the backfill script
are in and CI-green. Step 4 (provisioning the VM + bucket and switching
`STORAGE_DRIVER=gcs`) remains; see §9.

---

## 1. The key insight — the seam already exists

Nothing on any client references a raw storage path. The entire byte surface is
**three server-side functions**:

| Function | File | Role |
|---|---|---|
| `handleFileUpload` | `src/infrastructure/storage/fileStorage.ts` | writes bytes, records `resources_raw.storage_path` |
| `serveResourceFile` | `src/infrastructure/storage/fileStorage.ts` | reads bytes, streams them back |
| purge / orphan sweep | `scripts/purge-resources.ts` | deletes bytes + sweeps orphans |

- **Clients (web + mobile) only ever POST** multipart to `/api/resources/upload`
  and **GET** `/api/resources/:id/file`. The synced `resources.file_location`
  column is literally the string `/api/resources/<id>/file` — an app route, never a
  disk path. **→ No client change is required. Web and mobile ship unmodified.**
- The disk path lives **only** in the server-only `resources_raw.storage_path`
  (`communication-tables.ts:139`), which Electric never syncs.

So the migration is: **replace `fs.*` calls behind these three functions with a
storage provider, and change `storage_path` from an absolute FS path to a
provider-agnostic key.** Everything else — the tRPC txid handshake, the
`ON CONFLICT DO NOTHING` idempotency, the soft-delete/membership guards in
`serveResourceFile` (§3a, §8) — is byte-agnostic and stays exactly as is.

---

## 2. Target shape — a `StorageProvider` interface

New file `src/infrastructure/storage/provider.ts`:

```ts
export interface StorageProvider {
  /** Write bytes at `key`. Idempotent — overwriting the same key is fine. */
  put(key: string, body: Buffer, meta: { contentType: string }): Promise<void>
  /** Stream bytes back for proxying. Rejects/absent if the key is gone. */
  get(key: string): Promise<{ stream: ReadableStream; size: number } | null>
  /** Best-effort delete. A missing key is success. */
  delete(key: string): Promise<void>
  /** Keys under a prefix — used by the orphan sweep. */
  list(prefix: string): Promise<{ key: string; size: number; mtime: Date }[]>
  /** Optional: short-lived GCS signed URL (Phase 2, see §5). */
  signedUrl?(key: string, ttlSeconds: number): Promise<string>
}
```

Two implementations, selected by `STORAGE_DRIVER`:

- **`LocalFsStorage`** (`storage/drivers/local.ts`) — today's behaviour, refactored
  behind the interface. Keeps dev, `docker-compose`, and the Playwright E2E stack
  zero-config. Resolves a key to `UPLOADS_DIR/<key>` (guarding `../` escapes).
  **Keys only** — legacy absolute-path tolerance was deliberately dropped, so any
  row whose `storage_path` predates the migration must be normalised by the backfill
  before it will serve (see §6).
- **`GcsStorage`** (`storage/drivers/gcs.ts`) — `@google-cloud/storage`. The deploy
  target is **GCP** (decided 2026-07-19): the app on a **GCE VM**, bytes in **Google
  Cloud Storage**. In production the driver takes **no credentials** — it resolves
  them from ADC (the VM's attached service account, read from the metadata server);
  only `GCS_BUCKET` is mandatory. A fake-gcs-server emulator (`STORAGE_EMULATOR_HOST`)
  covers tests.

A `getStorage()` singleton factory reads env once (mirroring
`connection.ts`'s `process.env.DATABASE_URL` pattern) and throws on a missing
required var, same as `connection.ts` and `auth`.

### The storage key
`storage_path` stops being an absolute FS path and becomes a **stable key**:

```
resources/<resourceId>/<safeFilename>
```

Deterministic (one raw row per resource today), already how the local layout is
structured, and directly usable as a GCS object name.

---

## 3. Provider dependency

Add to the web package (`buildinlime`):

- `@google-cloud/storage` — the official GCS client. Its signed-URL support also
  covers Phase 2 (§5B), so no extra package is needed for that.

No client-side deps. Nothing added to mobile.

---

## 4. Config / env

| Var | Meaning |
|---|---|
| `STORAGE_DRIVER` | `local` (default) or `gcs` |
| `GCS_BUCKET` | bucket name (the only required var) |
| `GCS_PROJECT_ID` | project id; usually inferred from ADC, so optional |
| `GCS_KEY_FILENAME` | path to a service-account key for local dev; **omit in prod** — the GCE VM's attached service account provides ADC |
| `STORAGE_EMULATOR_HOST` | fake-gcs-server endpoint; tests only, unset against real GCS |

CI: the `build` job already injects dummy `DATABASE_URL`/`BETTER_AUTH_SECRET`
(`ci.yml:41`). `STORAGE_DRIVER` unset there defaults to `local`, so the prerender
never constructs a GCS client. The E2E stack stays on `local`.

---

## 5. Serving strategy — proxy first, presign as an opt-in

Two ways to serve a file, with a real trade-off:

- **(A) Proxy stream through the server** (default; matches today exactly).
  `serveResourceFile` keeps its auth → soft-delete → membership gate (§3a, §8) as
  the **sole** access control, then pipes the provider stream into the `Response`.
  Zero client change, identical security properties. **Ship this first.**
  Improvement over today for free: swap `fs.readFile` (whole file into a Buffer)
  for the provider's `ReadableStream`, so large files no longer buffer fully in
  app-server memory.
- **(B) Redirect to a short-lived GCS signed URL** (Phase 2 optimisation).
  Offloads bytes entirely from the app server — the point of going serverless at
  scale. **Cost:** a signed URL issued *before* a soft-delete stays valid until
  it expires, weakening the §8 soft-delete guard for that TTL window. Mitigate with
  a short TTL (e.g. 60s) and only adopt where byte-throughput actually justifies it.

**Recommendation:** land (A) with the migration; treat (B) as a follow-up gated on
observed egress cost. Correctness (A) before performance (B).

---

## 6. Migrating existing bytes

Because there is **no production environment** (§11), the only existing data is on
dev machines — low-stakes. Still, include a one-shot backfill so dev/staging
carries forward and the pattern is proven:

`scripts/migrate-storage-to-gcs.ts` — for each `resources_raw` row: read from the
old absolute path, `put(key, …)` into the provider, then `UPDATE storage_path = key`.
Dry-run by default with an `--apply` flag, mirroring `purge-resources.ts`'s
convention. Safe to re-run (idempotent puts).

Because the local driver **no longer tolerates absolute paths** (§2), the backfill
is **required for any environment that already has rows** — an un-normalised
absolute `storage_path` resolves to a non-existent key and serves 404. New dev
setups and the E2E stack start empty, so they need nothing; a populated dev/staging
DB must run the script (even on the local driver) to rewrite paths to keys.

---

## 7. Touch list (server only)

*(Status 2026-07-19: 1–6 DONE — §9 steps 1–3. Only the deploy provisioning, §9 step 4, remains.)*

1. ✅ **`storage/provider.ts`** — the `StorageProvider` interface.
   **`storage/index.ts`** — the `getStorage()` factory (split out so `provider.ts`
   stays a dependency-light, interface-only file).
2. ✅ **`storage/drivers/local.ts`**, **`storage/drivers/gcs.ts`** — impls.
3. ✅ **`fileStorage.ts`** — `handleFileUpload`: replace `fs.mkdir`/`fs.writeFile`
   with `storage.put(key, buffer, …)`; write the **key** into `storage_path`. On
   DB-tx failure, `storage.delete(key)` instead of `fs.unlink`/`fs.rmdir`
   (`fileStorage.ts:154`). Everything between (the 15s parent-poll, the txid
   transaction, `ON CONFLICT DO NOTHING`) is unchanged.
4. ✅ **`fileStorage.ts`** — `serveResourceFile`: replace `fs.readFile(raw.storage_path)`
   with `storage.get(raw.storage_path)`; stream the body. **All auth/membership/
   soft-delete checks unchanged.**
5. ✅ **`scripts/purge-resources.ts`** — swapped `rmFileAndDir` for `storage.delete(key)`,
   and the orphan sweep's `fs.readdir(UPLOADS_DIR)` for `storage.list("resources/")`
   diffed against `select storage_path from resources_raw`. Kept the
   `ORPHAN_GRACE_MINUTES` age floor and the dry-run default, and **added a guard**: the
   sweep refuses to run while any row still holds an absolute (pre-backfill) path, so
   it can't mistake live objects for orphans. (Also unblocks §12.9 — the purge is now
   provider-portable and schedulable against prod.)
6. ✅ **`scripts/migrate-storage-to-gcs.ts`** — backfill (new, §6). `pnpm migrate:storage`
   (dry-run) / `-- --apply`. Idempotent; skips rows already holding a key.

**Not touched:** any client code, the `resources`/`resources_raw` *schema* (only the
*meaning* of `storage_path` changes: FS path → key; no migration needed for a
`text` column), the tRPC routers, Electric shapes, the txid handshake.

---

## 8. Testing

- ✅ **Unit — provider conformance.** One shared suite (`tests/unit/storage-conformance.ts`)
  runs against both drivers: `put`→`get` round-trips bytes; `delete` is idempotent;
  `get` of a missing key → `null`; `list(prefix)` returns puts. `LocalFsStorage`
  runs against a temp dir (plus local-only tests for on-disk layout + `../` escape);
  `GcsStorage` runs against a **fake-gcs-server** emulator — skipped when
  `STORAGE_EMULATOR_HOST`/`GCS_BUCKET` are unset, so local `pnpm test` and CI stay
  offline by default.
- ✅ **Integration — the maintenance scripts** (`tests/integration/storage-scripts.test.ts`).
  Drives the real `migrate-storage-to-gcs.ts` / `purge-resources.ts` entrypoints as
  subprocesses (tsx) against the harness Postgres, with an isolated `LOCAL_STORAGE_DIR`:
  backfill rewrites absolute→key + copies bytes + is idempotent; retention purge frees
  bytes, drops the raw row, keeps the resources tombstone, and spares recent deletes;
  the orphan sweep removes an aged orphan but spares one inside the grace window and
  **aborts while any absolute path remains**.
- **Integration (still to add).** The existing `resources.delete` authz test (Phase 3)
  is byte-agnostic and keeps passing on the local driver. A `serveResourceFile` test —
  200 for a member, 404 for soft-deleted, 404 for a non-member — would pin that the §8
  guard survives the refactor; not yet written.
- **E2E.** Unchanged; the Playwright stack stays on `STORAGE_DRIVER=local`.
- **CI (optional).** Add a fake-gcs-server service to a new `storage` leg (or the
  `integration` job) to exercise the GCS driver against real GCS semantics. Gate
  behind `STORAGE_EMULATOR_HOST` so it's additive, never a new hard failure.

---

## 9. Sequencing

1. ✅ **Interface + local driver + refactor the 3 functions.** Behaviour-identical;
   ships behind `STORAGE_DRIVER=local`. Green CI, no deploy change. *(Pure
   refactor — the safe, reviewable core.)*
2. ✅ **GCS driver + shared provider conformance suite (fake-gcs-server).** Proves
   the two drivers behave identically.
3. ✅ **Backfill script + purge-script port** (unblocks §12.9 in the same stroke).
4. ⏳ **Provision the GCE VM + bucket** and switch `STORAGE_DRIVER=gcs` — the first
   point the app server holds no bytes, i.e. the first time §12.1 is actually closed.
   Steps: create the bucket (private, uniform bucket-level access); attach a service
   account to the VM with `roles/storage.objectAdmin` scoped to that bucket; set
   `STORAGE_DRIVER=gcs` + `GCS_BUCKET` in the VM's env (no key file — ADC via the
   metadata server); then run `pnpm migrate:storage -- --apply` once to move existing
   bytes and rewrite paths to keys before traffic hits the new driver.
5. **(Later, if egress warrants)** GCS signed-URL serving (§5B).

Steps 1–3 are done — §12.1 is now a config switch (`STORAGE_DRIVER`). Step 4 is GCP
provisioning (VM, bucket, service-account binding) plus the one-time backfill; the
deploy target is settled (GCP + GCE VM), so what's left there is infra, not a decision.

> **Ordering note for step 4:** run the backfill *after* pointing the app at
> `gcs` but the purge sweep *after* the backfill — the sweep aborts while any
> absolute path remains, which is the intended interlock, not a bug.

---

## 10. Watch-outs

- **`serveResourceFile` stays the only access gate.** Keep the GCS bucket private
  (uniform bucket-level access, no `allUsers`) and do not leak signed URLs with long
  TTLs — the §8 soft-delete guard is defeated the moment bytes are reachable without
  passing through that function (or a short-lived, deliberately-scoped signed URL).
- **Key, not path, in `storage_path` going forward** — the local driver rejects
  absolute paths, so a populated DB MUST run the backfill (§6) before it serves, or
  existing attachments 404. New/empty environments are unaffected.
- **Don't buffer whole files** — both drivers stream (`createReadStream` on GCS,
  `createReadStream` on local) into the `Response` (§5A). The old `fs.readFile`
  Buffer approach was a memory footgun the refactor removed; don't reintroduce it.
- **Purge age floor stays.** The orphan sweep must keep `ORPHAN_GRACE_MINUTES`
  (§12.9 / §12.10) or it races an in-flight upload whose bytes are `put` before its
  `resources_raw` row is written.
```
