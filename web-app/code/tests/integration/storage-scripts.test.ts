import { execFileSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  resourcesRawTable,
  resourcesTable,
} from "%/infrastructure/database/schema/admin-schema"
import { createResource, createUser, seedChannel } from "./factories"
import { TEST_DATABASE_URL } from "./setup/config"
import { db } from "./setup/db"

// Functional coverage for the two provider-portable maintenance scripts
// (migration step 3), driven end-to-end: real script entrypoints run as
// subprocesses against the harness Postgres, with an isolated LOCAL_STORAGE_DIR so
// the local driver's bytes never touch the repo's own uploads/. Asserts both the DB
// side (rows rewritten / purged / tombstoned) and the on-disk side (objects moved /
// removed / preserved).

const SCRIPTS = path.join(process.cwd(), "scripts")

let uploads: string

beforeEach(async () => {
  uploads = await fs.mkdtemp(path.join(os.tmpdir(), "bil-scripts-"))
})

afterEach(async () => {
  await fs.rm(uploads, { recursive: true, force: true })
})

/** Run a script through tsx with the test DB + an isolated local store. Returns stdout. */
function runScript(file: string, args: string[]): string {
  return execFileSync("pnpm", ["exec", "tsx", path.join(SCRIPTS, file), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      STORAGE_DRIVER: "local",
      LOCAL_STORAGE_DIR: uploads,
    },
  })
}

/** A resource owned by a fresh user in a fresh channel; optionally soft-deleted. */
async function seedResource(deletedAt: Date | null = null) {
  const user = await createUser()
  const seeded = await seedChannel(user)
  const resource = await createResource({
    channelId: seeded.channel.id,
    buildUnitId: seeded.buildUnit.id,
    projectId: seeded.project.id,
    createdById: user.id,
    deleted_at: deletedAt,
  })
  return resource
}

async function insertRaw(resourceId: string, storagePath: string, size: number) {
  await db.insert(resourcesRawTable).values({
    id: randomUUID(),
    resource_id: resourceId,
    storage_path: storagePath,
    original_filename: "report.pdf",
    mime_type: "application/pdf",
    file_size_bytes: size,
  })
}

/** Write an object into the isolated local store at the given key. */
async function writeObject(key: string, body: Buffer, mtime?: Date) {
  const full = path.join(uploads, key)
  await fs.mkdir(path.dirname(full), { recursive: true })
  await fs.writeFile(full, body)
  if (mtime) await fs.utimes(full, mtime, mtime)
  return full
}

const exists = (p: string) =>
  fs.stat(p).then(
    () => true,
    () => false,
  )

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)
const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000)

describe("migrate-storage-to-gcs.ts", () => {
  it("rewrites an absolute path to a key and copies the bytes, idempotently", async () => {
    const body = Buffer.from("hello world")
    // Legacy source lives outside the store, at an absolute path (pre-migration shape).
    const legacyDir = await fs.mkdtemp(path.join(os.tmpdir(), "bil-legacy-"))
    const absPath = path.join(legacyDir, "report.pdf")
    await fs.writeFile(absPath, body)

    const resource = await seedResource()
    await insertRaw(resource.id, absPath, body.length)

    const out = runScript("migrate-storage-to-gcs.ts", ["--apply"])
    expect(out).toContain("Migrated: 1 row(s)")

    const key = `resources/${resource.id}/report.pdf`
    const [raw] = await db
      .select()
      .from(resourcesRawTable)
      .where(eq(resourcesRawTable.resource_id, resource.id))
    expect(raw.storage_path).toBe(key)

    const moved = await fs.readFile(path.join(uploads, key))
    expect(moved.equals(body)).toBe(true)

    // Second run is a no-op: the row already holds a key.
    const rerun = runScript("migrate-storage-to-gcs.ts", ["--apply"])
    expect(rerun).toContain("already keys: 1")
    const [rawAfter] = await db
      .select()
      .from(resourcesRawTable)
      .where(eq(resourcesRawTable.resource_id, resource.id))
    expect(rawAfter.storage_path).toBe(key)

    await fs.rm(legacyDir, { recursive: true, force: true })
  })
})

describe("purge-resources.ts", () => {
  it("purges bytes past retention, keeps the resources tombstone, spares recent deletes", async () => {
    // Old soft-delete → should be purged.
    const oldRes = await seedResource(daysAgo(40))
    const oldKey = `resources/${oldRes.id}/report.pdf`
    const oldFile = await writeObject(oldKey, Buffer.from("old-bytes"))
    await insertRaw(oldRes.id, oldKey, 9)

    // Recent soft-delete → inside the window, should be spared.
    const newRes = await seedResource(daysAgo(1))
    const newKey = `resources/${newRes.id}/report.pdf`
    const newFile = await writeObject(newKey, Buffer.from("new-bytes"))
    await insertRaw(newRes.id, newKey, 9)

    runScript("purge-resources.ts", ["--apply"])

    // Old: bytes gone, raw row gone, resources row survives as a tombstone.
    expect(await exists(oldFile)).toBe(false)
    const oldRaw = await db
      .select()
      .from(resourcesRawTable)
      .where(eq(resourcesRawTable.resource_id, oldRes.id))
    expect(oldRaw).toHaveLength(0)
    const oldTombstone = await db
      .select()
      .from(resourcesTable)
      .where(eq(resourcesTable.id, oldRes.id))
    expect(oldTombstone).toHaveLength(1)

    // Recent: untouched.
    expect(await exists(newFile)).toBe(true)
    const newRaw = await db
      .select()
      .from(resourcesRawTable)
      .where(eq(resourcesRawTable.resource_id, newRes.id))
    expect(newRaw).toHaveLength(1)
  })

  it("sweeps an aged orphan but spares one inside the grace window", async () => {
    // No resources_raw rows point at these — pure on-disk orphans.
    const agedFile = await writeObject(
      `resources/${randomUUID()}/f.bin`,
      Buffer.from("aged"),
      hoursAgo(2),
    )
    const freshFile = await writeObject(`resources/${randomUUID()}/f.bin`, Buffer.from("fresh"))

    runScript("purge-resources.ts", ["--apply"])

    expect(await exists(agedFile)).toBe(false)
    expect(await exists(freshFile)).toBe(true)
  })

  it("refuses the orphan sweep while any row still holds an absolute path", async () => {
    // A pre-backfill row: absolute storage_path. The sweep must abort rather than
    // treat every listed object as an orphan.
    const legacyRes = await seedResource()
    await insertRaw(legacyRes.id, "/var/legacy/uploads/resources/x/report.pdf", 9)

    const agedOrphan = await writeObject(
      `resources/${randomUUID()}/f.bin`,
      Buffer.from("aged"),
      hoursAgo(2),
    )

    const out = runScript("purge-resources.ts", ["--apply"])
    expect(out).toContain("Skipping the orphan sweep")
    // The orphan survives because the sweep never ran.
    expect(await exists(agedOrphan)).toBe(true)
  })
})
