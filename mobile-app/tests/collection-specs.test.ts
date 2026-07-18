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

// The shared collection descriptors. These pin the two properties that are
// load-bearing and silent when wrong.

const ids = ["a", "b"]
const all = [
  usersSpec(),
  membershipsSpec(),
  channelMembersSpec(ids),
  projectsSpec(ids),
  buildUnitsSpec(ids),
  channelsSpec(ids),
  seenStateSpec(),
  inboxMentionsSpec(ids),
  myTasksSpec(ids),
  tasksSpec(ids),
  messagesSpec(ids),
  resourcesSpec(ids),
  propertiesSpec({
    memberProjectIds: ids,
    memberBuildunitIds: ids,
    memberChannelIds: ids,
  }),
]

describe("collection specs", () => {
  it("gives every collection a unique id", () => {
    // The id doubles as the collection's PERSISTENCE NAMESPACE. Two collections
    // sharing one would interleave their rows and offsets in the same namespace,
    // which surfaces as Electric reporting up-to-date while nothing renders —
    // the same failure mode as a mismatched schemaVersion (see ./collections).
    const seen = all.map((s) => s.id)
    expect(new Set(seen).size).toBe(seen.length)
  })

  it("gives every collection a unique route", () => {
    const paths = all.map((s) => s.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it("puts only the heavy screen-scoped collections on the idle-GC tier", () => {
    // NEVER_GC is Infinity, which makes startGCTimer() skip scheduling. Getting
    // this backwards is invisible until a badge goes stale (an always-mounted
    // collection that GC'd) or a shape never closes (a heavy one that cannot).
    const idle = all.filter((s) => Number.isFinite(s.gcTime)).map((s) => s.id).sort()
    expect(idle).toEqual(["messages", "properties", "resources", "tasks"])
  })

  it("omits the params key entirely for the unscoped shapes", () => {
    // These are scoped `user_id = me` server-side. Passing an empty id set would
    // be read as "unscoped" anyway, but the routes distinguish a MISSING
    // parameter from an empty one — see CollectionSpec.params.
    for (const spec of [usersSpec(), membershipsSpec(), seenStateSpec()]) {
      expect(spec.params).toBeUndefined()
    }
  })
})
