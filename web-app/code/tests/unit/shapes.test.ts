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
  it("projects ORs the member set with ownership", () => {
    // Was: `id = ANY(...) OR owner_id = '...'` — same, now parenthesised.
    expect(whereOf(shapes.projectsShape)).toBe(
      `(id = ANY(ARRAY['${PR}']::text[]) OR owner_id = '${ME}')`,
    )
  })

  it("channels ORs the member set with ownership", () => {
    expect(whereOf(shapes.channelsShape)).toBe(
      `(id = ANY(ARRAY['${CH}']::text[]) OR owner_id = '${ME}')`,
    )
  })

  it("keeps the owner escape hatch when the member set is empty", () => {
    // The whole point of the escape hatch: you see what you own before anyone
    // grants you membership. Must NOT collapse to `1 = 0`.
    expect(whereOf(shapes.projectsShape, { scope: emptyScope })).toBe(
      `owner_id = '${ME}'`,
    )
  })

  it("build units AND the project narrowing filter onto the access boundary", () => {
    // Precedence is the thing under test: the OR must be grouped, or the
    // project filter would leak every owned build unit past the boundary.
    expect(whereOf(shapes.buildUnitsShape, { query: `?project_id=${PR}` })).toBe(
      `(id = ANY(ARRAY['${BU}']::text[]) OR owner_id = '${ME}') AND project_id = '${PR}'`,
    )
  })

  it("ignores a malformed project_id rather than interpolating it", () => {
    const where = whereOf(shapes.buildUnitsShape, {
      query: `?project_id='; DROP TABLE build_units;--`,
    })
    expect(where).not.toContain("DROP")
    expect(where).toBe(`(id = ANY(ARRAY['${BU}']::text[]) OR owner_id = '${ME}')`)
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
    const where = whereOf(shapes.messagesShape, {
      query: `?member_channel_ids=${CH}`,
    })
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

describe("badge slices are bounded by a session-derived predicate", () => {
  // These two still take their channel ids from the client (see the
  // ⚠️ CLIENT-SCOPED notes in shapes.ts). What keeps that from being a leak is
  // the assignee/mention clause, so these assertions are load-bearing.
  it("my-tasks is bounded by assignee_id = me", () => {
    expect(whereOf(shapes.myTasksShape, { query: `?member_channel_ids=${CH}` })).toBe(
      `channel_id = ANY(ARRAY['${CH}']::text[]) AND assignee_id = '${ME}' AND deleted_at IS NULL`,
    )
  })

  it("inbox-mentions is bounded by mention_ids @> me", () => {
    expect(
      whereOf(shapes.inboxMentionsShape, { query: `?member_channel_ids=${CH}` }),
    ).toBe(
      `channel_id = ANY(ARRAY['${CH}']::text[]) AND mention_ids @> ARRAY['${ME}']::text[]`,
    )
  })

  it("default-denies both when no channel ids are supplied", () => {
    expect(whereOf(shapes.myTasksShape)).toContain(`1 = 0`)
    expect(whereOf(shapes.inboxMentionsShape)).toContain(`1 = 0`)
  })

  it("drops an injection payload from the client id param", () => {
    const where = whereOf(shapes.myTasksShape, {
      query: `?member_channel_ids=${encodeURIComponent("'; DROP TABLE tasks;--")}`,
    })
    expect(where).not.toContain("DROP")
    expect(where).toContain(`1 = 0`)
  })
})

describe("channel-members roster", () => {
  it("scopes to the requested channels and active members", () => {
    expect(whereOf(shapes.channelMembersShape, { query: `?channel_ids=${CH}` })).toBe(
      `channel_id = ANY(ARRAY['${CH}']::text[]) AND member_flag = true`,
    )
  })

  it("returns a well-formed match-nothing predicate when no channels are asked for", () => {
    // Must be a predicate Electric can resume from, not an empty body.
    expect(whereOf(shapes.channelMembersShape)).toBe(`false`)
  })
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
