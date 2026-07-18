import { describe, it, expect } from "vitest"
import {
  usersSpec,
  membershipsSpec,
  channelMembersSpec,
  projectsSpec,
  buildUnitsSpec,
  channelsSpec,
  seenStateSpec,
  inboxMentionsSpec,
  myTasksSpec,
  tasksSpec,
  messagesSpec,
  resourcesSpec,
  propertiesSpec,
} from "@buildinlime/sync-core"
import {
  userRowSchema,
  membershipRowSchema,
  projectRowSchema,
  buildUnitRowSchema,
  channelRowSchema,
  seenStateRowSchema,
  taskRowSchema,
  messageRowSchema,
  resourceRowSchema,
  propertyRowSchema,
} from "@buildinlime/contracts"

// Pins which SCHEMA each collection spec carries, which is what makes
// `defineCollection<XRow>` in application/collections/_shared.ts trustworthy.
//
// That helper ASSERTS its row type — `as unknown as Collection<TRow, string>` —
// because inference cannot reach it: sync-core types the injected tanstack
// builders as `(config: never) => object` so web and mobile can supply different
// persistence packages, so `buildCollectionOptions` returns a bare `object`.
// An assertion means a wrong TRow is not a type error; it is a silent lie that
// every useLiveQuery consumer then believes.
//
// The chain that closes it:
//   1. `XRow = z.infer<typeof xRowSchema>` — definitional, in contracts.
//   2. `spec.schema === xRowSchema` — asserted HERE.
//   ⇒ `defineCollection<XRow>({ ...xSpec() })` describes the rows that actually
//      arrive.
//
// Step 2 is the link nothing else checks, and it is the one that can rot: the
// spec type erases `schema` to `unknown` (that erasure is the root cause of the
// whole typecheck backlog), so pointing a spec at the wrong schema compiles
// cleanly. Note this pins the SPEC side only — passing a mismatched TRow at a
// call site is still a convention, not a compiler guarantee.

const ids = ["a", "b"]
const params = {
  memberProjectIds: ids,
  memberBuildunitIds: ids,
  memberChannelIds: ids,
}

const pairs: [string, { schema: unknown }, unknown][] = [
  ["users", usersSpec(), userRowSchema],
  ["memberships", membershipsSpec(), membershipRowSchema],
  ["channel-members", channelMembersSpec(ids), membershipRowSchema],
  ["projects", projectsSpec(ids), projectRowSchema],
  ["build-units", buildUnitsSpec(ids), buildUnitRowSchema],
  ["channels", channelsSpec(ids), channelRowSchema],
  ["seen-state", seenStateSpec(), seenStateRowSchema],
  ["tasks", tasksSpec(ids), taskRowSchema],
  ["my-tasks", myTasksSpec(ids), taskRowSchema],
  ["messages", messagesSpec(ids), messageRowSchema],
  ["inbox-mentions", inboxMentionsSpec(ids), messageRowSchema],
  ["resources", resourcesSpec(ids), resourceRowSchema],
  ["properties", propertiesSpec(params), propertyRowSchema],
]

describe("every collection spec carries the row schema its consumers assume", () => {
  for (const [name, spec, schema] of pairs) {
    it(`${name}`, () => {
      expect(spec.schema).toBe(schema)
    })
  }

  it("covers every spec sync-core exports", () => {
    // A new collection added without a pair here would otherwise be silently
    // unguarded — the failure this file exists to prevent.
    //
    // 13, not 14: `teams` is the one collection web defines inline rather than
    // from a shared spec, so its schema sits literally beside its row type in
    // application/collections/admin.ts and needs no indirection to check.
    expect(pairs).toHaveLength(13)
  })

  it("pairs the two shared-table shapes with the SAME schema as their sibling", () => {
    // channel-members re-shapes `memberships`, inbox-mentions re-shapes
    // `messages`, my-tasks re-shapes `tasks`. Different shapes, same rows — so
    // the same row type, and a divergence here would mistype a badge slice.
    expect(channelMembersSpec(ids).schema).toBe(membershipsSpec().schema)
    expect(inboxMentionsSpec(ids).schema).toBe(messagesSpec(ids).schema)
    expect(myTasksSpec(ids).schema).toBe(tasksSpec(ids).schema)
  })
})
