/**
 * Reclaims the bytes behind deleted files.
 *
 * Deleting a resource is SOFT: routers/resources.ts stamps deleted_at, the row drops
 * out of the Electric shape, and the stored object is deliberately left alone — a
 * delete there would make the soft-delete irreversible in the one dimension that
 * matters, since the metadata could be restored and would point at nothing. This
 * script is the other half of that bargain: it is what actually frees the bytes, on a
 * delay.
 *
 * Provider-portable: it talks to the configured StorageProvider (STORAGE_DRIVER), so
 * it reclaims from local disk or GCS with the same logic. Objects are addressed by
 * KEY (`resources/<id>/<file>`), the value now held in resources_raw.storage_path.
 *
 * DRY RUN BY DEFAULT. It reports what it would remove and touches nothing. Pass
 * --apply to let it delete.
 *
 *   pnpm purge:resources                      # report only
 *   pnpm purge:resources -- --apply           # actually delete
 *   pnpm purge:resources -- --retention=7     # override the 30-day window
 *
 * It does two separate jobs, and the second is the one that matters most:
 *
 * 1. RETENTION PURGE — files whose resource was soft-deleted longer ago than the
 *    retention window. The object is deleted and its resources_raw row removed; the
 *    resources row SURVIVES as a metadata tombstone (who deleted it, when), which
 *    also keeps any dangling messages.resource_ids reference harmless. The absence of
 *    a resources_raw row is what marks a resource as already purged, so re-running is
 *    a no-op.
 *
 * 2. ORPHAN SWEEP — stored objects that no resources_raw row points at. These are not
 *    hypothetical: resources_raw cascades from resources, which cascades from
 *    channels, build units, projects and users. Hard-delete a channel and every
 *    resource row under it disappears, taking the only record of its storage key with
 *    it — the bytes are then unreachable by any DB-driven job, and only a listing of
 *    the store can find them. A crashed upload leaves the same trace.
 *
 *    The age floor is what makes this safe: handleFileUpload writes the object BEFORE
 *    its DB transaction commits (and polls up to 15s for the parent row), so a sweep
 *    with no grace period would happily delete an upload that is still in flight.
 */
import path from "node:path"
import { Pool } from "pg"
import { getStorage } from "../src/infrastructure/storage/index"

const RESOURCE_KEY_PREFIX = `resources/`
const DEFAULT_RETENTION_DAYS = 30
// An upload's object exists in the store before its row exists in the DB. Anything
// younger than this is assumed to be mid-flight, not orphaned.
const ORPHAN_GRACE_MINUTES = 60

const args = process.argv.slice(2)
const apply = args.includes(`--apply`)
const retentionDays = Number(
  args.find((a) => a.startsWith(`--retention=`))?.split(`=`)[1] ?? DEFAULT_RETENTION_DAYS,
)

if (!Number.isFinite(retentionDays) || retentionDays < 0) {
  console.error(`--retention must be a non-negative number of days`)
  process.exit(1)
}

const fmt = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const storage = getStorage()
  const driver = process.env.STORAGE_DRIVER ?? `local`

  console.log(
    `${apply ? `PURGING` : `DRY RUN (nothing will be deleted — pass --apply)`}` +
      `  retention=${retentionDays}d  driver=${driver}\n`,
  )

  // ── 1. Retention purge ────────────────────────────────────────────────────
  const { rows: expired } = await pool.query<{
    resource_id: string
    raw_id: string
    name: string
    storage_path: string
    file_size_bytes: string
    deleted_at: Date
  }>(
    `select r.id as resource_id, rr.id as raw_id, r.name,
            rr.storage_path, rr.file_size_bytes, r.deleted_at
       from resources r
       join resources_raw rr on rr.resource_id = r.id
      where r.deleted_at is not null
        and r.deleted_at < now() - ($1 || ' days')::interval
      order by r.deleted_at`,
    [String(retentionDays)],
  )

  let freed = 0
  console.log(`Deleted longer than ${retentionDays}d ago: ${expired.length} file(s)`)
  for (const row of expired) {
    const size = Number(row.file_size_bytes)
    freed += size
    console.log(
      `  ${apply ? `purge` : `would purge`}  ${row.name}  ${fmt(size)}  ` +
        `(deleted ${row.deleted_at.toISOString().slice(0, 10)})`,
    )
    if (!apply) continue

    await storage.delete(row.storage_path)
    // Drop the raw row only after the bytes are gone: its absence is what marks this
    // resource purged. The resources row stays as the tombstone.
    await pool.query(`delete from resources_raw where id = $1`, [row.raw_id])
  }

  // ── 2. Orphan sweep ───────────────────────────────────────────────────────
  const { rows: known } = await pool.query<{ storage_path: string }>(
    `select storage_path from resources_raw`,
  )

  // Guard against a pre-backfill DB: legacy rows hold an ABSOLUTE path, not a key, so
  // every listed object would look unknown and the sweep would delete live files.
  // Refuse rather than risk it — run migrate-storage-to-gcs.ts first (see §6).
  const legacy = known.filter((r) => path.isAbsolute(r.storage_path)).length
  if (legacy > 0) {
    console.log(
      `\n⚠ ${legacy} resources_raw row(s) still hold an absolute storage_path (pre-migration). ` +
        `Skipping the orphan sweep — run scripts/migrate-storage-to-gcs.ts first, or it ` +
        `could delete live objects.`,
    )
    console.log(`\n${apply ? `Freed` : `Would free`}: ${fmt(freed)}`)
    await pool.end()
    return
  }

  const knownKeys = new Set(known.map((r) => r.storage_path))
  const cutoff = Date.now() - ORPHAN_GRACE_MINUTES * 60_000
  const orphans = (await storage.list(RESOURCE_KEY_PREFIX)).filter(
    (obj) => !knownKeys.has(obj.key) && obj.mtime.getTime() <= cutoff,
  )

  console.log(
    `\nOrphaned in the store (no resources_raw row, older than ${ORPHAN_GRACE_MINUTES}m): ` +
      `${orphans.length} object(s)`,
  )
  for (const obj of orphans) {
    freed += obj.size
    console.log(`  ${apply ? `remove` : `would remove`}  ${obj.key}  ${fmt(obj.size)}`)
    if (apply) await storage.delete(obj.key)
  }

  console.log(`\n${apply ? `Freed` : `Would free`}: ${fmt(freed)}`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
