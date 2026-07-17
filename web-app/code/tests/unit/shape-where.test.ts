import { describe, it, expect } from "vitest"
import {
  parseIdList,
  idListWhere,
} from "%/infrastructure/database/shape-where"

// The Electric shape `where` clause is built from client-supplied ids and run as
// raw SQL against Postgres (ARCHITECTURE.md §4). These tests pin the two
// security-critical invariants: only UUIDs survive, and an empty set is
// default-deny — never an unscoped or injectable query.

const A = "11111111-1111-4111-8111-111111111111"
const B = "22222222-2222-4222-8222-222222222222"

describe("parseIdList", () => {
  it("keeps only well-formed UUIDs", () => {
    expect(parseIdList(`${A},${B}`)).toEqual([A, B])
  })

  it("drops a SQL-injection payload entirely", () => {
    expect(parseIdList(`${A},'; DROP TABLE messages;--`)).toEqual([A])
  })

  it("returns [] for null, empty, or all-invalid input", () => {
    expect(parseIdList(null)).toEqual([])
    expect(parseIdList("")).toEqual([])
    expect(parseIdList("not-a-uuid,also-bad")).toEqual([])
  })

  it("trims surrounding whitespace", () => {
    expect(parseIdList(` ${A} , ${B} `)).toEqual([A, B])
  })
})

describe("idListWhere", () => {
  it("default-denies an empty id set with `1 = 0`", () => {
    expect(idListWhere("channel_id", [])).toBe("1 = 0")
  })

  it("builds an ANY(ARRAY[...]) clause for valid ids", () => {
    expect(idListWhere("channel_id", [A, B])).toBe(
      `channel_id = ANY(ARRAY['${A}','${B}']::text[])`,
    )
  })
})

describe("parse + build together: an injection attempt cannot escape", () => {
  it("collapses to default-deny, never an injected or unscoped clause", () => {
    const where = idListWhere(
      "channel_id",
      parseIdList("'; DROP TABLE messages;--"),
    )
    expect(where).toBe("1 = 0")
    expect(where).not.toContain("DROP")
  })
})
