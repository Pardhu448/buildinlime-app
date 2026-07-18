import { describe, it, expect, beforeEach, vi } from "vitest"

// Tests for the OPFS persistence owner marker — the guard that decides whether a
// login inherits the local replica or gets a clean one. Web port of mobile's
// tests/persistence-owner.test.ts; the two must stay in step.
//
// The failure this prevents: sign-out's wipe is best-effort and can race
// in-flight Electric sync writes. When it doesn't fully clear, the next session
// resumes from the previous session's Electric OFFSETS — Electric then reports
// "up-to-date" and never re-delivers, so every membership-scoped shape is empty
// for the whole session. Projects still render via the `owner_id = me` escape
// hatch, so it presents as "my build units vanished" rather than as an obviously
// broken app, and nothing self-heals it. See ARCHITECTURE.md §7.

const SUT = "%/infrastructure/persistence/browser-persistence"

const h = vi.hoisted(() => ({
  removed: [] as string[],
  entries: [] as string[],
}))

vi.mock("@tanstack/browser-db-sqlite-persistence", () => ({
  BrowserCollectionCoordinator: class {
    dispose() {}
  },
  createBrowserWASQLitePersistence: vi.fn(() => ({})),
  openBrowserWASQLiteOPFSDatabase: vi.fn(async () => ({ close: vi.fn() })),
}))

const KEY = "buildinlime.persistence_owner"
const DB = "buildinlime.sqlite"
const USER = "user-1"
const OTHER = "user-2"
const SESSION = "session-a"

beforeEach(() => {
  h.removed.length = 0
  h.entries = [DB]
  localStorage.clear()
  vi.resetModules()

  const root = {
    entries: async function* () {
      for (const name of h.entries) yield [name, { kind: "file" }]
    },
    removeEntry: vi.fn(async (name: string) => {
      if (!h.entries.includes(name)) throw new Error("NotFoundError")
      h.entries = h.entries.filter((e) => e !== name)
      h.removed.push(name)
    }),
  }
  vi.stubGlobal("navigator", {
    ...globalThis.navigator,
    storage: { getDirectory: async () => root },
  })
})

const load = async () => await import(SUT)

describe("ensureCleanPersistenceForUser", () => {
  it("wipes when there is no marker at all (first load, or post sign-out)", async () => {
    const { ensureCleanPersistenceForUser } = await load()
    await ensureCleanPersistenceForUser(USER, SESSION)
    expect(h.removed).toEqual([DB])
    expect(localStorage.getItem(KEY)).toBe(`${USER}:${SESSION}`)
  })

  it("is a NO-OP for the same user in the same session (reload keeps the cache)", async () => {
    localStorage.setItem(KEY, `${USER}:${SESSION}`)
    const { ensureCleanPersistenceForUser } = await load()
    await ensureCleanPersistenceForUser(USER, SESSION)
    // The whole point of persisting the replica: a reload must not re-sync.
    expect(h.removed).toEqual([])
  })

  it("wipes for the SAME user in a NEW session — the re-login with no sign-out", async () => {
    localStorage.setItem(KEY, `${USER}:old-session`)
    const { ensureCleanPersistenceForUser } = await load()
    await ensureCleanPersistenceForUser(USER, SESSION)
    expect(h.removed).toEqual([DB])
    // Asserting the marker WRITTEN matters as much as the wipe: it is what makes
    // this case fail under the old user-id-only scheme, which would have stored
    // a bare `${USER}` and matched forever after.
    expect(localStorage.getItem(KEY)).toBe(`${USER}:${SESSION}`)
  })

  it("wipes on a LEGACY user-only marker — the actual upgrade path", async () => {
    // What a browser that predates this change carries. Under the old scheme
    // this matched exactly and skipped the wipe, which IS the bug: same user,
    // re-login, stale Electric offsets inherited, build units gone. It is also
    // how anyone currently stuck gets unstuck, so it must wipe exactly once.
    localStorage.setItem(KEY, USER)
    const { ensureCleanPersistenceForUser } = await load()
    await ensureCleanPersistenceForUser(USER, SESSION)
    expect(h.removed).toEqual([DB])
    expect(localStorage.getItem(KEY)).toBe(`${USER}:${SESSION}`)
  })

  it("wipes when the store belongs to a different user", async () => {
    localStorage.setItem(KEY, `${OTHER}:${SESSION}`)
    const { ensureCleanPersistenceForUser } = await load()
    await ensureCleanPersistenceForUser(USER, SESSION)
    expect(h.removed).toEqual([DB])
  })

  it("removes sibling journal/WAL files, not just the main database", async () => {
    // A wipe that leaves a journal behind is not a wipe.
    h.entries = [DB, `${DB}-journal`, `${DB}-wal`, "unrelated-app.db"]
    const { ensureCleanPersistenceForUser } = await load()
    await ensureCleanPersistenceForUser(USER, SESSION)
    expect(h.removed.sort()).toEqual([DB, `${DB}-journal`, `${DB}-wal`].sort())
    // Scoped to our prefix — the OPFS root belongs to the whole origin.
    expect(h.removed).not.toContain("unrelated-app.db")
  })

  it("succeeds when there are no files to remove", async () => {
    h.entries = []
    const { ensureCleanPersistenceForUser } = await load()
    await expect(ensureCleanPersistenceForUser(USER, SESSION)).resolves.toBeUndefined()
    expect(localStorage.getItem(KEY)).toBe(`${USER}:${SESSION}`)
  })

  describe("when no session id is available", () => {
    it("wipes rather than trusting the store", async () => {
      localStorage.setItem(KEY, `${USER}:${SESSION}`)
      const { ensureCleanPersistenceForUser } = await load()
      await ensureCleanPersistenceForUser(USER, "")
      expect(h.removed).toEqual([DB])
    })

    it("leaves NO marker, so the next load cannot match it either", async () => {
      const { ensureCleanPersistenceForUser } = await load()
      await ensureCleanPersistenceForUser(USER, "")
      expect(localStorage.getItem(KEY)).toBeNull()
      expect(localStorage.getItem(KEY)).not.toBe(`${USER}:`)
    })
  })
})

describe("disposePersistence", () => {
  it("clears the marker so the next sign-in wipes, even if the delete fails", async () => {
    localStorage.setItem(KEY, `${USER}:${SESSION}`)
    const { disposePersistence } = await load()
    await disposePersistence()
    // Marker gone => next ensureCleanPersistenceForUser mismatches and re-wipes,
    // which is what makes correctness independent of this racy delete.
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})
