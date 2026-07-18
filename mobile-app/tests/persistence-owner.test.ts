import { describe, it, expect, beforeEach, vi } from "vitest"

// Tests for the persistence owner marker — the guard that decides whether a
// login inherits the local SQLite store or gets a clean one.
//
// This is the third revision of the same bug. A raced/failed sign-out delete
// leaves the store behind with STALE ELECTRIC OFFSETS; Electric then reports
// "up-to-date" and never re-delivers the rows, so membership-scoped data (build
// units, most visibly) silently never appears. First fix wiped when the DB
// belonged to a different USER; second cleared the marker on sign-out to cover
// same-user sign-out → sign-in; neither covered a re-login that never went
// through sign-out at all (app kill, expired session), because the marker still
// matched. Keying it on the SESSION id closes that, and these cases pin every
// branch so it does not regress a fourth time.

const SUT = "@/src/infrastructure/persistence/expo-persistence"

const h = vi.hoisted(() => ({
  store: new Map<string, string>(),
  deletedDbs: [] as string[],
  closed: { n: 0 },
}))

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (k: string) => h.store.get(k) ?? null),
  setItemAsync: vi.fn(async (k: string, v: string) => void h.store.set(k, v)),
  deleteItemAsync: vi.fn(async (k: string) => void h.store.delete(k)),
}))

vi.mock("expo-sqlite", () => ({
  openDatabaseSync: vi.fn(() => ({
    execSync: vi.fn(),
    closeSync: vi.fn(() => void h.closed.n++),
  })),
  deleteDatabaseAsync: vi.fn(async (name: string) => void h.deletedDbs.push(name)),
}))

vi.mock("@tanstack/expo-db-sqlite-persistence", () => ({
  createExpoSQLitePersistence: vi.fn(() => ({})),
  persistedCollectionOptions: vi.fn(),
}))

const KEY = "buildinlime.persistence_owner"
const USER = "user-1"
const OTHER = "user-2"
const SESSION = "session-a"

beforeEach(() => {
  h.store.clear()
  h.deletedDbs.length = 0
  h.closed.n = 0
  vi.resetModules()
})

const load = async () => await import(SUT)

describe("ensureCleanPersistenceForUser", () => {
  it("wipes when there is no marker at all (fresh install, or post sign-out)", async () => {
    const { ensureCleanPersistenceForUser } = await load()
    await ensureCleanPersistenceForUser(USER, SESSION)
    expect(h.deletedDbs).toEqual(["buildinlime.sqlite"])
    expect(h.store.get(KEY)).toBe(`${USER}:${SESSION}`)
  })

  it("is a NO-OP for the same user in the same session (app restart keeps the cache)", async () => {
    h.store.set(KEY, `${USER}:${SESSION}`)
    const { ensureCleanPersistenceForUser } = await load()
    await ensureCleanPersistenceForUser(USER, SESSION)
    // The whole point of persisting the replica: a restart must not re-sync.
    expect(h.deletedDbs).toEqual([])
  })

  it("wipes for the SAME user in a NEW session — the re-login that had no sign-out", async () => {
    // The regression this change exists for. Old marker was the user id alone,
    // so this case matched and skipped the wipe, and the stale offset survived.
    h.store.set(KEY, `${USER}:old-session`)
    const { ensureCleanPersistenceForUser } = await load()
    await ensureCleanPersistenceForUser(USER, SESSION)
    expect(h.deletedDbs).toEqual(["buildinlime.sqlite"])
    expect(h.store.get(KEY)).toBe(`${USER}:${SESSION}`)
  })

  it("wipes when the store belongs to a different user", async () => {
    h.store.set(KEY, `${OTHER}:${SESSION}`)
    const { ensureCleanPersistenceForUser } = await load()
    await ensureCleanPersistenceForUser(USER, SESSION)
    expect(h.deletedDbs).toEqual(["buildinlime.sqlite"])
  })

  it("migrates a legacy user-only marker by wiping once", async () => {
    // Devices upgrading from the previous scheme carry `${userId}`. It must not
    // be mistaken for a match — including for the user who is currently stuck.
    h.store.set(KEY, USER)
    const { ensureCleanPersistenceForUser } = await load()
    await ensureCleanPersistenceForUser(USER, SESSION)
    expect(h.deletedDbs).toEqual(["buildinlime.sqlite"])
    expect(h.store.get(KEY)).toBe(`${USER}:${SESSION}`)
  })

  describe("when no session id is available", () => {
    it("wipes rather than trusting the store", async () => {
      h.store.set(KEY, `${USER}:${SESSION}`)
      const { ensureCleanPersistenceForUser } = await load()
      await ensureCleanPersistenceForUser(USER, "")
      expect(h.deletedDbs).toEqual(["buildinlime.sqlite"])
    })

    it("leaves NO marker, so the next launch cannot match it either", async () => {
      // `${userId}:` must never be written: it would match on the next launch
      // and reinstate exactly the hole this closes.
      const { ensureCleanPersistenceForUser } = await load()
      await ensureCleanPersistenceForUser(USER, "")
      expect(h.store.has(KEY)).toBe(false)
      expect(h.store.get(KEY)).not.toBe(`${USER}:`)
    })
  })

  it("treats an unreadable marker as unknown and wipes", async () => {
    const secureStore = await import("expo-secure-store")
    vi.mocked(secureStore.getItemAsync).mockRejectedValueOnce(new Error("keystore locked"))
    const { ensureCleanPersistenceForUser } = await load()
    await ensureCleanPersistenceForUser(USER, SESSION)
    expect(h.deletedDbs).toEqual(["buildinlime.sqlite"])
  })
})

describe("disposePersistence", () => {
  it("clears the marker so the next sign-in wipes, even if the delete fails", async () => {
    h.store.set(KEY, `${USER}:${SESSION}`)
    const { disposePersistence } = await load()
    await disposePersistence()
    // Marker gone => next ensureCleanPersistenceForUser mismatches and re-wipes,
    // which is what makes correctness independent of this racy delete.
    expect(h.store.has(KEY)).toBe(false)
  })
})
