import { test, expect } from "@playwright/test"
import { readSeed, channelUrl } from "./helpers"

// Cross-client sync (ARCHITECTURE.md §3, §4): a write by user A reaches user B
// through Electric, not through B refetching. Two isolated browser contexts, each
// authenticated as a different seeded member of the same channel.

const s = readSeed()
const url = channelUrl(s)

test("a message user A posts reaches user B via Electric", async ({ browser }) => {
  const ctxA = await browser.newContext({ storageState: s.userA.statePath })
  const ctxB = await browser.newContext({ storageState: s.userB.statePath })
  try {
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    await pageA.goto(url)
    await pageB.goto(url)

    const composerA = pageA.getByPlaceholder("Write a comment…")
    await expect(composerA).toBeVisible()
    await expect(pageB.getByPlaceholder("Write a comment…")).toBeVisible()

    const msg = `cross-client message ${Date.now()}`
    await composerA.click()
    await composerA.fill(msg)
    await composerA.press("Control+Enter")

    // A sees it optimistically immediately.
    await expect(pageA.getByText(msg)).toBeVisible()

    // Reload A to drain its outbox to the server. In headless the offline
    // executor's leader election / online detection does not fire on a plain
    // enqueue-while-online, so the durable outbox flushes on the next executor
    // init (page load) instead — the same path the offline-sync spec exercises.
    // This is a test-env quirk, not the behaviour under test: what we assert is
    // the Electric fan-out to B.
    await pageA.reload()

    // B receives it over the Electric sync stream (long-poll — allow generous time).
    await expect(pageB.getByText(msg)).toBeVisible({ timeout: 45_000 })
  } finally {
    await ctxA.close()
    await ctxB.close()
  }
})
