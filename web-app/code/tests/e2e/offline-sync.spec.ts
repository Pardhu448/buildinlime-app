import { test, expect } from "@playwright/test"
import { readSeed, channelUrl } from "./helpers"

// The differentiating end-to-end path (ARCHITECTURE.md §5): optimistic writes
// applied to the local store while OFFLINE, drained through the durable outbox on
// reconnect, and surviving a reload. Uses the default (user A) storageState.

const s = readSeed()
const url = channelUrl(s)

test("optimistic writes go through the offline outbox and survive reload", async ({
  page,
  context,
}) => {
  await page.goto(url)

  const composer = page.getByPlaceholder("Write a comment…")
  await expect(composer).toBeVisible()

  // 1. Post a message while ONLINE (baseline).
  const onlineMsg = `online message ${Date.now()}`
  await composer.click()
  await composer.fill(onlineMsg)
  await composer.press("Control+Enter")
  await expect(page.getByText(onlineMsg)).toBeVisible()

  // 2. Go offline.
  await context.setOffline(true)

  // 3. Create a task offline — appears optimistically in the Tasks panel.
  const taskName = `Offline Task ${Date.now()}`
  await page.getByRole("button", { name: "Add Task" }).first().click()
  const taskInput = page.getByPlaceholder("Enter task name")
  await taskInput.fill(taskName)
  await taskInput.press("Enter")
  await expect(page.getByText(taskName)).toBeVisible()

  // 4. Delete the seeded resource offline — vanishes optimistically.
  page.once("dialog", (d) => d.accept())
  await page.getByTitle("Delete for everyone").first().click()
  await expect(page.getByText(s.resourceName)).toHaveCount(0)

  // 5. Reconnect — the outbox drains FIFO to the server.
  await context.setOffline(false)

  // 6. Reload — the offline mutations persisted (local + server) and the online
  //    message is still there; the deleted resource stays gone.
  await page.reload()
  await expect(page.getByPlaceholder("Write a comment…")).toBeVisible()
  await expect(page.getByText(taskName)).toBeVisible()
  await expect(page.getByText(onlineMsg)).toBeVisible()
  await expect(page.getByText(s.resourceName)).toHaveCount(0)
})
