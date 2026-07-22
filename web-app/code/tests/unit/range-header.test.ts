import { describe, expect, it } from "vitest"
import { parseRangeHeader } from "%/infrastructure/storage/fileStorage"

// parseRangeHeader turns a `Range` request header into the slice serveResourceFile
// should stream (206), the sentinel for an out-of-bounds range (416), or null when
// there is no usable range and the whole file should go back (200).

const SIZE = 1000

describe("parseRangeHeader", () => {
  it("returns null when there is no Range header", () => {
    expect(parseRangeHeader(null, SIZE)).toBeNull()
  })

  it("parses a fully-specified range inclusively", () => {
    expect(parseRangeHeader("bytes=0-499", SIZE)).toEqual({ start: 0, end: 499 })
    expect(parseRangeHeader("bytes=200-299", SIZE)).toEqual({ start: 200, end: 299 })
  })

  it("defaults a missing end to the last byte", () => {
    expect(parseRangeHeader("bytes=500-", SIZE)).toEqual({ start: 500, end: 999 })
  })

  it("handles the suffix form (last N bytes)", () => {
    expect(parseRangeHeader("bytes=-100", SIZE)).toEqual({ start: 900, end: 999 })
    // A suffix larger than the file clamps to the whole file.
    expect(parseRangeHeader("bytes=-5000", SIZE)).toEqual({ start: 0, end: 999 })
  })

  it("clamps an end past EOF to the last byte", () => {
    expect(parseRangeHeader("bytes=900-5000", SIZE)).toEqual({ start: 900, end: 999 })
  })

  it("reports ranges that start at or past EOF as unsatisfiable", () => {
    expect(parseRangeHeader("bytes=1000-1100", SIZE)).toBe("unsatisfiable")
    expect(parseRangeHeader("bytes=-0", SIZE)).toBe("unsatisfiable")
  })

  it("treats an inverted range as unsatisfiable", () => {
    expect(parseRangeHeader("bytes=500-200", SIZE)).toBe("unsatisfiable")
  })

  it("satisfies nothing on an empty file", () => {
    expect(parseRangeHeader("bytes=0-0", 0)).toBe("unsatisfiable")
  })

  it("ignores malformed or multi-range headers (serve the whole file)", () => {
    expect(parseRangeHeader("bytes=abc-def", SIZE)).toBeNull()
    expect(parseRangeHeader("bytes=0-99,200-299", SIZE)).toBeNull()
    expect(parseRangeHeader("items=0-99", SIZE)).toBeNull()
    expect(parseRangeHeader("bytes=-", SIZE)).toBeNull()
  })
})
