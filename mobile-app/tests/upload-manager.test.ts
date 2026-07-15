import { describe, it, expect, beforeEach, vi } from "vitest"

// State-machine tests for the mobile upload manager (ARCHITECTURE.md §8): a
// singleton service that must survive screen unmounts, resume interrupted
// uploads, back off on failure, and wait for reconnection. Every dependency is a
// module import, so the whole thing is exercised in-process with mocks + fake
// timers — no jest-expo, no device.

const SUT = "@/src/infrastructure/offline/upload-manager"

// Shared mock state. vi.hoisted runs before the (hoisted) vi.mock factories, so
// they can close over it; tests reach it too.
const h = vi.hoisted(() => {
  let online = true
  const listeners = new Set<() => void>()
  const rows = new Map<string, Record<string, unknown>>()
  const cookieFetch = vi.fn()
  const fs = {
    documentDirectory: "file:///doc/",
    makeDirectoryAsync: vi.fn().mockResolvedValue(undefined),
    copyAsync: vi.fn().mockResolvedValue(undefined),
    deleteAsync: vi.fn().mockResolvedValue(undefined),
  }
  const idRef = { n: 0 }
  const detector = {
    isOnline: () => online,
    subscribe: (cb: () => void) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    notifyOnline: () => {},
  }
  return {
    rows,
    cookieFetch,
    fs,
    idRef,
    detector,
    setOnline: (v: boolean) => (online = v),
    fireOnline: () => {
      online = true
      for (const l of listeners) l()
    },
    reset: () => {
      online = true
      listeners.clear()
      rows.clear()
      idRef.n = 0
      cookieFetch.mockReset()
      fs.makeDirectoryAsync.mockClear()
      fs.copyAsync.mockClear()
      fs.deleteAsync.mockClear()
    },
  }
})

vi.mock("expo-file-system/legacy", () => h.fs)
vi.mock("expo-crypto", () => ({ randomUUID: () => `id-${++h.idRef.n}` }))
vi.mock("@/src/infrastructure/auth/cookie-fetch", () => ({
  createCookieFetch: () => h.cookieFetch,
}))
vi.mock("@/src/infrastructure/offline/online-detector", () => ({
  getOnlineDetector: () => h.detector,
}))
vi.mock("@/src/infrastructure/offline/pending-uploads-db", () => ({
  getAll: async () => [...h.rows.values()],
  put: async (r: { resource_id: string } & Record<string, unknown>) => {
    h.rows.set(r.resource_id, r)
  },
  updateStatus: async (id: string, status: string, msg?: string) => {
    const r = h.rows.get(id)
    if (r) {
      r.status = status
      r.error_message = msg ?? null
    }
  },
  updateSchedule: async (id: string, status: string, when: string) => {
    const r = h.rows.get(id)
    if (r) {
      r.status = status
      r.scheduled_at = when
    }
  },
  remove: async (id: string) => {
    h.rows.delete(id)
  },
  clear: async () => h.rows.clear(),
  disposeUploadsDb: async () => {},
}))

const OPTS = {
  name: "photo.pdf",
  mimeType: "application/pdf",
  channelId: "chan-1",
  buildUnitId: "bu-1",
  projectId: "proj-1",
  createdById: "user-1",
  messageId: null,
}

const okResponse = () => ({ ok: true, json: async () => ({}) })
const failResponse = () => ({
  ok: false,
  status: 500,
  json: async () => ({ error: "boom" }),
})

type UploadManager = typeof import("@/src/infrastructure/offline/upload-manager")
const load = (): Promise<UploadManager> => import(SUT)

beforeEach(() => {
  vi.useRealTimers()
  vi.resetModules()
  h.reset()
})

describe("enqueue + start", () => {
  it("rests in awaiting_schedule until startUpload fires it", async () => {
    const um = await load()
    const id = await um.enqueueUpload("file:///picked", OPTS, {
      autoStart: false,
    })

    expect(um.getUploads()[0]?.status).toBe("awaiting_schedule")
    expect(h.cookieFetch).not.toHaveBeenCalled()

    h.cookieFetch.mockResolvedValue(okResponse())
    um.startUpload(id)

    // Success drops the row and the local copy.
    await vi.waitFor(() => expect(um.getUploads()).toHaveLength(0))
    expect(h.cookieFetch).toHaveBeenCalledTimes(1)
    expect(h.fs.deleteAsync).toHaveBeenCalled()
  })
})

describe("online failure backoff", () => {
  it("marks error and retries on an exponential (1s, 2s) schedule", async () => {
    const um = await load()
    vi.useFakeTimers()
    h.setOnline(true)
    h.cookieFetch.mockResolvedValue(failResponse())

    const id = await um.enqueueUpload("file:///picked", OPTS, {
      autoStart: false,
    })
    um.startUpload(id)

    await vi.advanceTimersByTimeAsync(0)
    expect(h.cookieFetch).toHaveBeenCalledTimes(1)
    expect(um.getUploads()[0]?.status).toBe("error")

    await vi.advanceTimersByTimeAsync(1000) // 1000 * 2^0
    expect(h.cookieFetch).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(2000) // 1000 * 2^1
    expect(h.cookieFetch).toHaveBeenCalledTimes(3)
  })
})

describe("offline failure then reconnect", () => {
  it("parks in awaiting_network with no timer, and retries when online", async () => {
    const um = await load()
    await um.initUploadManager() // wires the reconnect subscription
    h.setOnline(false)
    h.cookieFetch.mockRejectedValue(new Error("network down"))

    const id = await um.enqueueUpload("file:///picked", OPTS)
    await vi.waitFor(() =>
      expect(um.getUploads()[0]?.status).toBe("awaiting_network"),
    )
    expect(h.cookieFetch).toHaveBeenCalledTimes(1)

    // Reconnect: the detector fires, the manager retries the parked upload.
    h.cookieFetch.mockResolvedValue(okResponse())
    h.fireOnline()

    await vi.waitFor(() => expect(um.getUploads()).toHaveLength(0))
    expect(h.cookieFetch).toHaveBeenCalledTimes(2)
    void id
  })
})

describe("re-entrancy", () => {
  it("collapses concurrent doUpload calls into a single POST", async () => {
    const um = await load()
    let release!: (v: unknown) => void
    h.cookieFetch.mockImplementation(
      () => new Promise((res) => (release = res)),
    )

    const id = await um.enqueueUpload("file:///picked", OPTS, {
      autoStart: false,
    })
    um.startUpload(id) // A — enters flight, awaits fetch
    um.startUpload(id) // B — inFlight guard returns immediately

    await vi.waitFor(() => expect(h.cookieFetch).toHaveBeenCalledTimes(1))
    // Give any erroneous second POST a chance to land, then confirm none did.
    await Promise.resolve()
    expect(h.cookieFetch).toHaveBeenCalledTimes(1)

    release(okResponse())
    await vi.waitFor(() => expect(um.getUploads()).toHaveLength(0))
  })
})

describe("cancel", () => {
  it("drops the upload, its row and its local file", async () => {
    const um = await load()
    const id = await um.enqueueUpload("file:///picked", OPTS, {
      autoStart: false,
    })

    await um.cancelUpload(id)

    expect(um.getUploads()).toHaveLength(0)
    expect(h.rows.size).toBe(0)
    expect(h.fs.deleteAsync).toHaveBeenCalled()
  })
})

describe("rename", () => {
  it("renames while idle but refuses once the bytes are in flight", async () => {
    const um = await load()
    const id = await um.enqueueUpload("file:///picked", OPTS, {
      autoStart: false,
    })

    expect(await um.renameUpload(id, "renamed.pdf")).toBe(true)
    expect(um.getUploads()[0]?.name).toBe("renamed.pdf")

    let release!: (v: unknown) => void
    h.cookieFetch.mockImplementation(
      () => new Promise((res) => (release = res)),
    )
    um.startUpload(id)
    await vi.waitFor(() =>
      expect(um.getUploads()[0]?.status).toBe("uploading"),
    )

    // Form data is already built — a rename can no longer apply.
    expect(await um.renameUpload(id, "too-late.pdf")).toBe(false)
    release(okResponse())
  })
})
