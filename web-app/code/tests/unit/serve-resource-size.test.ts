import { describe, it, expect, vi, beforeEach } from "vitest"

// serveResourceFile has two candidate sizes for a file: the number recorded in
// resources_raw.file_size_bytes at upload time, and the object's real length as
// reported by the store. It must serve the store's.
//
// When it trusted the DB and the two had drifted:
//   db > real → content-length promised bytes that were never sent, and an
//               HTTP/1.1 client waits on a body that never completes
//   db < real → ranges clamped short, and seeks past the DB's idea of EOF
//               returned 416 for bytes that exist
// Neither shows up while the two agree, so these tests deliberately drive them
// apart. `dbSize` and `realSize` differing is the whole point of the fixture.

const state = vi.hoisted(() => ({
  dbSize: 1000,
  realSize: 1000,
  /** Every get() the handler made, in order. */
  gets: [] as Array<{ range?: { start: number; end: number } }>,
  /** Streams handed out, so a test can assert an unused one was cancelled. */
  cancelled: [] as boolean[],
}))

vi.mock("%/infrastructure/auth/server", () => ({
  auth: { api: { getSession: async () => ({ user: { id: "u1" } }) } },
}))

// The handler issues three queries in order: resource, membership, raw record.
vi.mock("%/infrastructure/database/connection", () => {
  let call = 0
  const results = () => [
    [{ id: "r1", channel_id: "c1", deleted_at: null }],
    [{ id: "m1" }],
    [
      {
        resource_id: "r1",
        storage_path: "resources/r1/clip.mp4",
        file_size_bytes: state.dbSize,
        mime_type: "video/mp4",
        original_filename: "clip.mp4",
      },
    ],
  ]
  return {
    db: {
      select: () => ({
        from: () => ({ where: () => Promise.resolve(results()[call++ % 3]) }),
      }),
    },
  }
})

vi.mock("%/infrastructure/database/schema/admin-schema", () => ({
  resourcesTable: { id: "id", channel_id: "channel_id", deleted_at: "deleted_at" },
  resourcesRawTable: { resource_id: "resource_id" },
  messagesTable: { id: "id" },
  membershipTable: { id: "id", user_id: "user_id", channel_id: "channel_id", member_flag: "member_flag" },
  tasksTable: { id: "id" },
}))

vi.mock("drizzle-orm", () => ({
  eq: () => ({}),
  and: () => ({}),
  sql: () => ({}),
}))

vi.mock("%/infrastructure/storage/index", () => ({
  getStorage: () => ({
    get: async (_key: string, opts?: { range?: { start: number; end: number } }) => {
      state.gets.push({ range: opts?.range })
      const index = state.cancelled.length
      state.cancelled.push(false)
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]))
          controller.close()
        },
        cancel() {
          state.cancelled[index] = true
        },
      })
      // Mirrors both drivers: `size` is the FULL object length even for a ranged
      // read (provider.ts documents this explicitly).
      return { stream, size: state.realSize }
    },
  }),
}))

const { serveResourceFile } = await import("%/infrastructure/storage/fileStorage")

const serve = (range?: string) =>
  serveResourceFile(
    new Request("http://localhost/api/resources/r1/file", {
      headers: range ? { range } : {},
    }),
    { resourceId: "r1" },
  )

beforeEach(() => {
  state.dbSize = 1000
  state.realSize = 1000
  state.gets = []
  state.cancelled = []
  vi.restoreAllMocks()
})

describe("serveResourceFile size source", () => {
  it("serves the storage size, not the DB size, on a full response", async () => {
    // The hang case: the DB claims more bytes than the object holds.
    state.dbSize = 5000
    state.realSize = 1000

    const res = await serve()

    expect(res.status).toBe(200)
    expect(res.headers.get("content-length")).toBe("1000")
  })

  it("keeps content-length correct when the two agree", async () => {
    const res = await serve()

    expect(res.status).toBe(200)
    expect(res.headers.get("content-length")).toBe("1000")
    expect(res.headers.get("accept-ranges")).toBe("bytes")
  })

  it("uses the storage size as the content-range denominator", async () => {
    state.dbSize = 5000
    state.realSize = 1000

    const res = await serve("bytes=0-99")

    expect(res.status).toBe(206)
    expect(res.headers.get("content-range")).toBe("bytes 0-99/1000")
    expect(res.headers.get("content-length")).toBe("100")
  })

  it("re-fetches the corrected slice when the DB size inflated the range", async () => {
    // `bytes=900-` resolves to 900-4999 against the DB's 5000 but must be
    // 900-999 against the real object. Serving the first slice's bounds would
    // declare 4100 bytes and send 100.
    state.dbSize = 5000
    state.realSize = 1000

    const res = await serve("bytes=900-")

    expect(res.status).toBe(206)
    expect(res.headers.get("content-range")).toBe("bytes 900-999/1000")
    expect(res.headers.get("content-length")).toBe("100")

    expect(state.gets).toEqual([
      { range: { start: 900, end: 4999 } }, // provisional, from the DB number
      { range: { start: 900, end: 999 } }, // corrected, from the store
    ])
    expect(state.cancelled[0]).toBe(true) // the wrong slice was not leaked
  })

  it("416s against the real size when the range is past the true EOF", async () => {
    state.dbSize = 5000
    state.realSize = 1000

    const res = await serve("bytes=2000-2999")

    expect(res.status).toBe(416)
    expect(res.headers.get("content-range")).toBe("bytes */1000")
    expect(state.cancelled[0]).toBe(true)
  })

  it("serves bytes the DB would have wrongly called unsatisfiable", async () => {
    // The opposite drift: the object is bigger than the row claims. The old code
    // 416'd here without ever asking storage.
    state.dbSize = 500
    state.realSize = 2000

    const res = await serve("bytes=1500-1599")

    expect(res.status).toBe(206)
    expect(res.headers.get("content-range")).toBe("bytes 1500-1599/2000")
    expect(res.headers.get("content-length")).toBe("100")
  })

  it("makes exactly one storage call when the sizes agree", async () => {
    // The correction path must not cost a second round trip on the happy path.
    await serve("bytes=0-99")

    expect(state.gets).toEqual([{ range: { start: 0, end: 99 } }])
  })

  it("warns when the row and the object disagree", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    state.dbSize = 5000
    state.realSize = 1000

    await serve()

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("size mismatch"))
  })
})
