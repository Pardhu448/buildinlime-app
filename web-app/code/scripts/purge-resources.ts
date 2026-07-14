/**
 * Reclaims the bytes behind deleted files.
 *
 * Deleting a resource is SOFT: routers/resources.ts stamps deleted_at, the row drops
 * out of the Electric shape, and the file on disk is deliberately left alone — an
 * unlink there would make the delete irreversible in the one dimension that matters,
 * since the metadata could be restored and would point at nothing. This script is the
 * other half of that bargain: it is what actually frees the disk, on a delay.
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
 *    retention window. The file is unlinked and its resources_raw row removed; the
 *    resources row SURVIVES as a metadata tombstone (who deleted it, when), which
 *    also keeps any dangling messages.resource_ids reference harmless. The absence of
 *    a resources_raw row is what marks a resource as already purged, so re-running is
 *    a no-op.
 *
 * 2. ORPHAN SWEEP — files on disk that no resources_raw row points at. These are not
 *    hypothetical: resources_raw cascades from resources, which cascades from
 *    channels, build units, projects and users. Hard-delete a channel and every
 *    resource row under it disappears, taking the only record of its storage path
 *    with it — the bytes are then unreachable by any DB-driven job, and only a
 *    directory scan can find them. A crashed upload leaves the same trace.
 *
 *    The age floor is what makes this safe: handleFileUpload writes the file BEFORE
 *    its DB transaction commits (and polls up to 15s for the parent row), so a sweep
 *    with no grace period would happily delete an upload that is still in flight.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { Pool } from "pg"

const UPLOADS_DIR = path.resolve(process.cwd(), `uploads`, `resources`)
const DEFAULT_RETENTION_DAYS = 30
// An upload's file exists on disk before its row exists in the DB. Anything younger
// than this is assumed to be mid-flight, not orphaned.
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

/** Never unlink anything outside the uploads tree, whatever the DB says. */
function assertInsideUploads(p: string) {
  const resolved = path.resolve(p)
  if (resolved !== UPLOADS_DIR && !resolved.startsWith(UPLOADS_DIR + path.sep)) {
    throw new Error(`refusing to touch a path outside ${UPLOADS_DIR}: ${resolved}`)
  }
  return resolved
}

async function rmFileAndDir(storagePath: string) {
  const file = assertInsideUploads(storagePath)
  await fs.unlink(file).catch(() => {
    /* already gone — fine, this is idempotent */
  })
  // The per-resource directory exists only for this file; drop it if it is now empty.
  await fs.rmdir(path.dirname(file)).catch(() => {
    /* not empty, or already gone */
  })
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  console.log(
    `${apply ? `PURGING` : `DRY RUN (nothing will be deleted — pass --apply)`}` +
      `  retention=${retentionDays}d  uploads=${UPLOADS_DIR}\n`,
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

    await rmFileAndDir(row.storage_path)
    // Drop the raw row only after the bytes are gone: its absence is what marks this
    // resource purged. The resources row stays as the tombstone.
    await pool.query(`delete from resources_raw where id = $1`, [row.raw_id])
  }

  // ── 2. Orphan sweep ───────────────────────────────────────────────────────
  const { rows: known } = await pool.query<{ storage_path: string }>(
    `select storage_path from resources_raw`,
  )
  const knownDirs = new Set(known.map((r) => path.dirname(path.resolve(r.storage_path))))

  let dirs: string[] = []
  try {
    dirs = await fs.readdir(UPLOADS_DIR)
  } catch {
    console.log(`\nNo uploads directory at ${UPLOADS_DIR} — nothing to sweep.`)
  }

  const cutoff = Date.now() - ORPHAN_GRACE_MINUTES * 60_000
  const orphans: { dir: string; size: number }[] = []

  for (const entry of dirs) {
    const dir = path.join(UPLOADS_DIR, entry)
    const stat = await fs.stat(dir).catch(() => null)
    if (!stat?.isDirectory()) continue
    if (knownDirs.has(dir)) continue
    // Mid-flight upload: the file lands before the DB row does.
    if (stat.mtimeMs > cutoff) continue

    let size = 0
    for (const f of await fs.readdir(dir).catch(() => [])) {
      const s = await fs.stat(path.join(dir, f)).catch(() => null)
      if (s?.isFile()) size += s.size
    }
    orphans.push({ dir, size })
  }

  console.log(
    `\nOrphaned on disk (no resources_raw row, older than ${ORPHAN_GRACE_MINUTES}m): ` +
      `${orphans.length} director${orphans.length === 1 ? `y` : `ies`}`,
  )
  for (const o of orphans) {
    freed += o.size
    console.log(`  ${apply ? `remove` : `would remove`}  ${path.basename(o.dir)}  ${fmt(o.size)}`)
    if (apply) await fs.rm(assertInsideUploads(o.dir), { recursive: true, force: true })
  }

  console.log(`\n${apply ? `Freed` : `Would free`}: ${fmt(freed)}`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
