import { describe, it, expect } from "vitest"
import { buildStatusNoteText } from "@/src/presentation/tasks/lib/status-note"

// The task status note is posted as an ordinary channel message, and
// messages.text is varchar(500) — so this composer has to fit an arbitrary task
// name and an arbitrary note into that budget. Pure TypeScript, so it is tested
// directly rather than through the screen.

describe("buildStatusNoteText", () => {
  it("labels completion and reopening differently", () => {
    expect(
      buildStatusNoteText({ taskName: "Pour slab", next: "completed", note: "cured 48h" })
    ).toBe("Task completed: Pour slab — cured 48h")

    expect(
      buildStatusNoteText({ taskName: "Pour slab", next: "open", note: "rebar off" })
    ).toBe("Task reopened: Pour slab — rebar off")
  })

  it("truncates the task NAME, never the note, and stays within 500 chars", () => {
    const note = "n".repeat(200)
    const text = buildStatusNoteText({
      taskName: "x".repeat(600),
      next: "completed",
      note,
    })

    expect(text.length).toBeLessThanOrEqual(500)
    // The note is the part worth keeping, so it survives intact...
    expect(text.endsWith(` — ${note}`)).toBe(true)
    // ...and the name is what gives way, marked with an ellipsis.
    expect(text).toContain("…")
  })

  it("uses the full budget when the name is what overflows", () => {
    const text = buildStatusNoteText({
      taskName: "x".repeat(600),
      next: "completed",
      note: "n",
    })
    expect(text).toHaveLength(500)
  })

  it("leaves a name that already fits untouched", () => {
    const text = buildStatusNoteText({
      taskName: "Short name",
      next: "completed",
      note: "done",
    })
    expect(text).not.toContain("…")
  })
})
