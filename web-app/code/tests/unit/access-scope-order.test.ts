import { describe, it, expect, vi, beforeEach } from "vitest"

// resolveMemberScope's arrays are interpolated POSITIONALLY into the Electric
// `where` clause by idSetWhere, so their order is part of the shape's identity.
// The two SELECTs behind them carry no ORDER BY, and Postgres guarantees no row
// order without one — a plan flip, an autovacuum, or an UPDATE moving a row to a
// new page can reorder them at any time.
//
// If that happens without the sort, every client takes a full refetch of
// messages/tasks/resources/properties simultaneously. These tests feed the same
// rows back in different orders and assert the output does not move.

const rows = vi.hoisted(() => ({ memberships: [] as unknown[], owned: [] as unknown[] }))

// Minimal stand-in for drizzle's builder: db.select(...).from(...).where(...)
// resolves to the row array. Which array depends on call order — memberships is
// queried first, owned channels second (they're issued together in a
// Promise.all, but constructed in that order).
vi.mock("%/infrastructure/database/connection", () => {
  let call = 0
  return {
    db: {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve(call++ % 2 === 0 ? rows.memberships : rows.owned),
        }),
      }),
    },
  }
})

vi.mock("%/infrastructure/database/schema/admin-schema", () => ({
  membershipTable: { user_id: "user_id", channel_id: "channel_id", buildunit_id: "buildunit_id", project_id: "project_id", member_flag: "member_flag" },
  channelsTable: { id: "id", buildunit_id: "buildunit_id", owner_id: "owner_id" },
}))

const { resolveMemberScope } = await import("%/infrastructure/database/access-scope")

const CH_A = "aaaaaaaa-1111-4111-8111-111111111111"
const CH_B = "bbbbbbbb-2222-4222-8222-222222222222"
const CH_C = "cccccccc-3333-4333-8333-333333333333"
const BU_A = "aaaaaaaa-4444-4444-8444-444444444444"
const BU_B = "bbbbbbbb-5555-4555-8555-555555555555"
const PR_A = "aaaaaaaa-6666-4666-8666-666666666666"
const PR_B = "bbbbbbbb-7777-4777-8777-777777777777"

const membership = (channel: string, buildunit: string, project: string) => ({
  channel_id: channel,
  buildunit_id: buildunit,
  project_id: project,
})

beforeEach(() => {
  rows.memberships = []
  rows.owned = []
})

describe("resolveMemberScope id ordering", () => {
  it("returns the same arrays no matter what order Postgres hands the rows back", async () => {
    rows.memberships = [
      membership(CH_C, BU_B, PR_B),
      membership(CH_A, BU_A, PR_A),
      membership(CH_B, BU_A, PR_A),
    ]
    const first = await resolveMemberScope("u1")

    // Same rows, different order — what a plan change or an autovacuum produces.
    rows.memberships = [
      membership(CH_B, BU_A, PR_A),
      membership(CH_C, BU_B, PR_B),
      membership(CH_A, BU_A, PR_A),
    ]
    const second = await resolveMemberScope("u1")

    expect(second).toEqual(first)
    expect(first.channelIds).toEqual([CH_A, CH_B, CH_C])
    expect(first.buildunitIds).toEqual([BU_A, BU_B])
    expect(first.projectIds).toEqual([PR_A, PR_B])
  })

  it("is stable across the membership/owned-channel union too", async () => {
    // The owned-channels query is a defensive union, so an id can arrive from
    // either side. Which side it came from must not change the output either.
    rows.memberships = [membership(CH_C, BU_B, PR_B)]
    rows.owned = [
      { channel_id: CH_A, buildunit_id: BU_A },
      { channel_id: CH_B, buildunit_id: BU_A },
    ]
    const first = await resolveMemberScope("u1")

    rows.memberships = [membership(CH_C, BU_B, PR_B)]
    rows.owned = [
      { channel_id: CH_B, buildunit_id: BU_A },
      { channel_id: CH_A, buildunit_id: BU_A },
    ]
    const second = await resolveMemberScope("u1")

    expect(second).toEqual(first)
    expect(first.channelIds).toEqual([CH_A, CH_B, CH_C])
  })

  it("still de-duplicates", async () => {
    // Sorting must not have cost the Set semantics: an owner with a membership
    // row appears on both sides of the union.
    rows.memberships = [membership(CH_A, BU_A, PR_A)]
    rows.owned = [{ channel_id: CH_A, buildunit_id: BU_A }]

    const scope = await resolveMemberScope("u1")

    expect(scope.channelIds).toEqual([CH_A])
    expect(scope.buildunitIds).toEqual([BU_A])
  })

  it("keeps an empty scope empty (default-deny stays default-deny)", async () => {
    const scope = await resolveMemberScope("u1")

    expect(scope.channelIds).toEqual([])
    expect(scope.buildunitIds).toEqual([])
    expect(scope.projectIds).toEqual([])
  })
})
