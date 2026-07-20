import { afterAll, describe, expect, it } from "vitest"
import type { StorageProvider } from "%/infrastructure/storage/provider"

// Driver-agnostic StorageProvider conformance. Both the local and GCS drivers run
// this same suite (migration step 2), so the two behave identically where it matters:
// round-trip, missing→null, idempotent delete, prefix list. Driver-specific concerns
// (the local on-disk layout, `../` escapes) live in the driver's own test file.

export async function readAll(stream: ReadableStream): Promise<Buffer> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  return Buffer.concat(chunks)
}

export function runStorageConformance(label: string, getProvider: () => StorageProvider): void {
  describe(`StorageProvider conformance: ${label}`, () => {
    // Namespaced per label so a shared bucket (a real GCS/emulator target) never
    // collides across drivers, and afterAll can sweep exactly what this run wrote.
    const prefix = `conformance/${label}/`

    afterAll(async () => {
      const provider = getProvider()
      for (const entry of await provider.list(prefix)) {
        await provider.delete(entry.key)
      }
    })

    it("round-trips bytes through put → get", async () => {
      const key = `${prefix}round-trip.bin`
      const body = Buffer.from("hello world")
      await getProvider().put(key, body, { contentType: "application/octet-stream" })

      const obj = await getProvider().get(key)
      expect(obj).not.toBeNull()
      expect(obj!.size).toBe(body.length)
      expect((await readAll(obj!.stream)).equals(body)).toBe(true)
    })

    it("returns null for a missing key", async () => {
      expect(await getProvider().get(`${prefix}does-not-exist-${Math.random()}.bin`)).toBeNull()
    })

    it("deletes idempotently", async () => {
      const key = `${prefix}delete-me.bin`
      await getProvider().put(key, Buffer.from("x"), { contentType: "application/octet-stream" })
      await getProvider().delete(key)
      expect(await getProvider().get(key)).toBeNull()
      // A second delete of an already-gone key is a no-op, never throws.
      await expect(getProvider().delete(key)).resolves.toBeUndefined()
    })

    it("lists keys under a prefix", async () => {
      const key = `${prefix}listing/a.txt`
      await getProvider().put(key, Buffer.from("aa"), { contentType: "text/plain" })
      const listed = await getProvider().list(prefix)
      const found = listed.find((entry) => entry.key === key)
      expect(found).toBeDefined()
      expect(found!.size).toBe(2)
    })
  })
}
