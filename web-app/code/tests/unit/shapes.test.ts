import { describe, it, expect } from "vitest"
import type { MemberScope } from "%/infrastructure/database/access-scope"
import type { ShapeDef, MemberCtx } from "%/infrastructure/database/shape-route"
import * as shapes from "%/infrastructure/database/shapes"

// Pins the `where` clause every Electric shape emits (ARCHITECTURE.md §4).
//
// The strings here were captured from the hand-written route handlers that
// preceded infrastructure/database/shapes.ts, so this file is the evidence that
// collapsing fifteen handlers into descriptors did not move a single boundary.
// Three of them (projects, channels, properties) gained outer parentheses from
// or() — semantically inert, but noted at each case, because a changed where
// string means a new Electric shape handle and a one-time refetch.
//
// They also stand on their own as authorization tests: an empty id set must be
// default-deny, and the owner escape hatch must be present exactly where the
// architecture says it is.
//
// The strongest invariant here is the one asserted last: NO descriptor may read
// an id set out of the query string. That is what the four scope fixes closed,
// and a regression would look exactly like the bug they fixed.

const ME = "11111111-1111-4111-8111-111111111111"
const CH = "33333333-3333-4333-8333-333333333333"
const BU = "44444444-4444-4444-8444-444444444444"
const PR = "22222222-2222-4222-8222-222222222222"

const scope: MemberScope = {
  channelIds: [CH],
  buildunitIds: [BU],
  projectIds: [PR],
}
const emptyScope: MemberScope = { channelIds: [], buildunitIds: [], projectIds: [] }

/** Evaluate a descriptor the way shapeHandler does, minus the network. */
function whereOf(
  def: ShapeDef,
  opts: { query?: string; scope?: MemberScope } = {},
): string | undefined {
  const url = new URL(`http://x/api/whatever${opts.query ?? ""}`)
  const ctx = { userId: ME, url, scope: opts.scope ?? scope }
  return (def.where as ((c: MemberCtx) => string) | undefined)?.(ctx)
}

describe("user-scoped shapes", () => {
  it("users streams unscoped — no where param at all", () => {
    expect(whereOf(shapes.usersShape)).toBeUndefined()
  })

  it("memberships keeps its byte-stable self-stream clause", () => {
    // Byte-identical to the old handler: this shape's handle must never churn.
    expect(whereOf(shapes.membershipsShape)).toBe(
      `user_id = '${ME}' AND member_flag = true`,
    )
  })

  it("seen-state and reads are the caller's own rows only", () => {
    expect(whereOf(shapes.seenStateShape)).toBe(`user_id = '${ME}'`)
    expect(whereOf(shapes.readsShape)).toBe(`user_id = '${ME}'`)
  })

  it("teams is owner-scoped", () => {
    expect(whereOf(shapes.teamsShape)).toBe(`owner_id = '${ME}'`)
  })
})

describe("owner-escape shapes", () => {
  it("projects ORs the member set with ownership and hides soft-deleted rows", () => {
    // The OR is parenthesised and notDeleted is AND-ed outside it, so an owned
    // project that has been soft-deleted still falls out of the shape.
    expect(whereOf(shapes.projectsShape)).toBe(
      `(id = ANY(ARRAY['${PR}']::text[]) OR owner_id = '${ME}') AND deleted_at IS NULL`,
    )
  })

  it("channels ORs the member set with ownership and hides soft-deleted rows", () => {
    expect(whereOf(shapes.channelsShape)).toBe(
      `(id = ANY(ARRAY['${CH}']::text[]) OR owner_id = '${ME}') AND deleted_at IS NULL`,
    )
  })

  it("keeps the owner escape hatch when the member set is empty", () => {
    // The whole point of the escape hatch: you see what you own before anyone
    // grants you membership. Must NOT collapse to `1 = 0`.
    expect(whereOf(shapes.projectsShape, { scope: emptyScope })).toBe(
      `owner_id = '${ME}' AND deleted_at IS NULL`,
    )
  })

  it("build units AND the project narrowing filter onto the access boundary", () => {
    // Precedence is the thing under test: the OR must be grouped, or the
    // project filter would leak every owned build unit past the boundary.
    expect(whereOf(shapes.buildUnitsShape, { query: `?project_id=${PR}` })).toBe(
      `(id = ANY(ARRAY['${BU}']::text[]) OR owner_id = '${ME}') AND project_id = '${PR}' AND deleted_at IS NULL`,
    )
  })

  it("ignores a malformed project_id rather than interpolating it", () => {
    const where = whereOf(shapes.buildUnitsShape, {
      query: `?project_id='; DROP TABLE build_units;--`,
    })
    expect(where).not.toContain("DROP")
    expect(where).toBe(`(id = ANY(ARRAY['${BU}']::text[]) OR owner_id = '${ME}') AND deleted_at IS NULL`)
  })
})

describe("channel-scoped shapes have no owner escape hatch", () => {
  it("tasks and resources filter soft-deleted rows out of the shape", () => {
    const expected = `channel_id = ANY(ARRAY['${CH}']::text[]) AND deleted_at IS NULL`
    expect(whereOf(shapes.tasksShape)).toBe(expected)
    expect(whereOf(shapes.resourcesShape)).toBe(expected)
  })

  it("messages deliberately keeps deleted rows so threads survive", () => {
    // A deleted parent must keep syncing or its replies orphan. The row is
    // redacted server-side, so the tombstone carries no text.
    const where = whereOf(shapes.messagesShape)
    expect(where).toBe(`channel_id = ANY(ARRAY['${CH}']::text[])`)
    expect(where).not.toContain("deleted_at")
  })

  it("default-denies when the caller can see no channels", () => {
    expect(whereOf(shapes.tasksShape, { scope: emptyScope })).toBe(
      `1 = 0 AND deleted_at IS NULL`,
    )
  })

  it("properties ORs entity scope, channel scope and the creator hatch", () => {
    expect(whereOf(shapes.propertiesShape)).toBe(
      `(entity_id = ANY(ARRAY['${PR}','${BU}']::text[])` +
        ` OR channel_id = ANY(ARRAY['${CH}']::text[])` +
        ` OR createdby_id = '${ME}')`,
    )
  })
})

describe("badge slices carry their session-derived predicate", () => {
  it("my-tasks is scoped to visible channels AND assignee_id = me", () => {
    expect(whereOf(shapes.myTasksShape)).toBe(
      `channel_id = ANY(ARRAY['${CH}']::text[]) AND assignee_id = '${ME}' AND deleted_at IS NULL`,
    )
  })

  it("inbox-mentions is scoped to visible channels AND mention_ids @> me", () => {
    expect(whereOf(shapes.inboxMentionsShape)).toBe(
      `channel_id = ANY(ARRAY['${CH}']::text[]) AND mention_ids @> ARRAY['${ME}']::text[]`,
    )
  })

  it("default-denies both when the caller can see no channels", () => {
    expect(whereOf(shapes.myTasksShape, { scope: emptyScope })).toContain(`1 = 0`)
    expect(whereOf(shapes.inboxMentionsShape, { scope: emptyScope })).toContain(`1 = 0`)
  })
})

describe("channel-members roster", () => {
  it("scopes to the caller's visible channels and active members", () => {
    expect(whereOf(shapes.channelMembersShape)).toBe(
      `channel_id = ANY(ARRAY['${CH}']::text[]) AND member_flag = true`,
    )
  })

  it("default-denies with a predicate Electric can resume from", () => {
    // Not an empty body — the client cannot resume from that.
    expect(whereOf(shapes.channelMembersShape, { scope: emptyScope })).toBe(
      `1 = 0 AND member_flag = true`,
    )
  })
})

describe("no descriptor takes an id set from the query string", () => {
  // The regression guard for the four scope fixes. Every id-set param a client
  // has ever sent, pointed at a channel/project/buildunit the caller cannot see,
  // against a caller whose real scope is empty. Nothing may come back carrying
  // the attacker's id — a shape that reads any of these is the IDOR again.
  //
  // /api/buildunits' `project_id` is deliberately NOT in this list: it is a
  // narrowing filter AND-ed inside the access boundary, so it appears in the
  // output by design and can only restrict. Its own cases cover it above.
  const EVIL = "99999999-9999-4999-8999-999999999999"
  const params = [
    "member_channel_ids",
    "member_buildunit_ids",
    "member_project_ids",
    "member_ids",
    "channel_ids",
  ]
  const query = `?${params.map((p) => `${p}=${EVIL}`).join("&")}`

  for (const [name, def] of Object.entries(shapes)) {
    it(`${name} ignores client-supplied ids`, () => {
      const where = whereOf(def, { query, scope: emptyScope })
      expect(where ?? "").not.toContain(EVIL)
    })
  }
})

describe("every descriptor names a real table", () => {
  it("targets only known Electric-synced tables", () => {
    const known = new Set([
      "users",
      "memberships",
      "seen_state",
      "reads",
      "teams",
      "projects",
      "build_units",
      "channels",
      "tasks",
      "resources",
      "messages",
      "properties",
    ])
    for (const [name, def] of Object.entries(shapes)) {
      expect(known, `${name} targets an unknown table`).toContain(def.table)
    }
  })
})
