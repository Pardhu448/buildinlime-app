import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { LocalFsStorage } from "%/infrastructure/storage/drivers/local"
import { readAll, runStorageConformance } from "./storage-conformance"

// The local driver runs the shared conformance suite (parity with GCS) plus the
// local-only guarantees: byte-identical on-disk layout and `../` escape refusal.

let baseDir: string
let storage: LocalFsStorage

beforeAll(async () => {
  baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "bil-storage-"))
  storage = new LocalFsStorage(baseDir)
})

afterAll(async () => {
  await fs.rm(baseDir, { recursive: true, force: true })
})

runStorageConformance("local", () => storage)

describe("LocalFsStorage (local-specific)", () => {
  it("lands bytes at the expected key path (byte-identical to the old layout)", async () => {
    const key = "resources/abc-123/report.pdf"
    const body = Buffer.from("hello world")
    await storage.put(key, body, { contentType: "application/pdf" })

    const onDisk = await fs.readFile(path.join(baseDir, "resources", "abc-123", "report.pdf"))
    expect(onDisk.equals(body)).toBe(true)

    const obj = await storage.get(key)
    expect((await readAll(obj!.stream)).equals(body)).toBe(true)
  })

  it("prunes the empty resource dir after delete", async () => {
    const key = "resources/del-1/f.bin"
    await storage.put(key, Buffer.from("x"), { contentType: "application/octet-stream" })
    await storage.delete(key)
    await expect(fs.stat(path.join(baseDir, "resources", "del-1"))).rejects.toThrow()
  })

  it("refuses a path outside the base dir", async () => {
    await expect(
      storage.put("../escape.txt", Buffer.from("no"), { contentType: "text/plain" })
    ).rejects.toThrow(/outside/)
  })
})
