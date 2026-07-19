/**
 * One-shot backfill: rewrites every resources_raw row from the old absolute FS path
 * to a storage KEY, copying the bytes into the configured StorageProvider on the way.
 *
 * Why it exists: before the object-storage migration, storage_path held an absolute
 * filesystem path; afterwards it holds a key (`resources/<id>/<file>`) and the local
 * driver no longer resolves absolute paths (legacy tolerance was dropped). So any
 * environment with pre-migration rows MUST run this once, or those attachments 404 —
 * and the orphan sweep in purge-resources.ts refuses to run until it's done. New /
 * empty environments need nothing. See agentGuides/objectStorageMigration.md §6.
 *
 * DRY RUN BY DEFAULT. Pass --apply to copy bytes and update rows.
 *
 *   pnpm migrate:storage                 # report what would move
 *   pnpm migrate:storage -- --apply      # copy into the provider + rewrite storage_path
 *
 * Idempotent: rows already holding a key are skipped, and puts overwrite, so a
 * re-run (e.g. after an interrupted first pass) is safe. The target is whatever
 * STORAGE_DRIVER selects — `gcs` for the real migration, `local` to normalise a dev
 * DB's paths to keys in place.
 *
 * Source bytes are always read from the local filesystem (the pre-migration home),
 * regardless of the target driver.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { Pool } from "pg"
import { getStorage } from "../src/infrastructure/storage/index"

const args = process.argv.slice(2)
const apply = args.includes(`--apply`)

const fmt = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

/** `<absolute>/uploads/resources/<id>/<file>` → `resources/<id>/<file>`. */
function keyForRow(resourceId: string, absolutePath: string): string {
  return `resources/${resourceId}/${path.basename(absolutePath)}`
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const storage = getStorage()
  const driver = process.env.STORAGE_DRIVER ?? `local`

  console.log(
    `${apply ? `MIGRATING` : `DRY RUN (nothing will be written — pass --apply)`}` +
      `  target=${driver}\n`,
  )

  const { rows } = await pool.query<{
    id: string
    resource_id: string
    storage_path: string
    mime_type: string
    file_size_bytes: string
  }>(
    `select id, resource_id, storage_path, mime_type, file_size_bytes from resources_raw`,
  )

  let migrated = 0
  let skipped = 0
  let missing = 0
  let bytes = 0

  for (const row of rows) {
    // Already a key → nothing to do (idempotent re-run).
    if (!path.isAbsolute(row.storage_path)) {
      skipped++
      continue
    }

    const key = keyForRow(row.resource_id, row.storage_path)

    let body: Buffer
    try {
      body = await fs.readFile(row.storage_path)
    } catch {
      // Bytes already gone (purged, or a dangling raw row). Leave the row untouched
      // and report it rather than silently rewriting a key that points at nothing.
      missing++
      console.log(`  ⚠ missing bytes  ${row.storage_path}  (row ${row.id} left as-is)`)
      continue
    }

    migrated++
    bytes += body.length
    console.log(`  ${apply ? `move` : `would move`}  ${row.storage_path}  →  ${key}  ${fmt(body.length)}`)
    if (!apply) continue

    await storage.put(key, body, { contentType: row.mime_type })
    await pool.query(`update resources_raw set storage_path = $1 where id = $2`, [key, row.id])
  }

  console.log(
    `\n${apply ? `Migrated` : `Would migrate`}: ${migrated} row(s), ${fmt(bytes)}` +
      `  |  already keys: ${skipped}  |  missing bytes: ${missing}`,
  )
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
