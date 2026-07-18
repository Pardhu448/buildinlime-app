import { describe, it, expect } from "vitest"
import { idSetWhere } from "%/infrastructure/database/shape-where"

// The Electric shape `where` clause is run as raw SQL against Postgres
// (ARCHITECTURE.md §4). Its ids are now all server-resolved, so what is left to
// pin here is default-deny: an empty id set must match nothing, never everything.
// The descriptors that consume this are covered in ./shapes.test.ts.

const A = "11111111-1111-4111-8111-111111111111"
const B = "22222222-2222-4222-8222-222222222222"

describe("idSetWhere", () => {
  it("default-denies an empty id set with `1 = 0`", () => {
    expect(idSetWhere("channel_id", [])).toBe("1 = 0")
  })

  it("builds an ANY(ARRAY[...]) clause for valid ids", () => {
    expect(idSetWhere("channel_id", [A, B])).toBe(
      `channel_id = ANY(ARRAY['${A}','${B}']::text[])`,
    )
  })
})
