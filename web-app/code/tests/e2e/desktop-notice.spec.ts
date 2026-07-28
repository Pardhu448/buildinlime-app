import { test, expect } from "@playwright/test"
import { readSeed, channelUrl } from "./helpers"

// -----------------------------------------------------------------------------
// The desktop-recommended notice, in its post-sign-in home.
//
// It is gated on TWO things at once — a sub-`lg` viewport AND an authenticated
// session — which is why it lives here under the "mobile" project rather than in
// tests/responsive: that suite has the viewports but never signs in (it boots
// with dummy env and only walks marketing routes), while this suite has the
// seeded session but ran desktop-only until this spec was added.
//
// The responsive suite still owns the other half of the contract: that no route
// into /login raises a dialog at any width.
// -----------------------------------------------------------------------------

const seed = readSeed()

test.describe("desktop-recommended notice, post sign-in", () => {
  test("appears on a phone once the workspace loads", async ({ page }) => {
    await page.goto("/projects")

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(/desktop/i)

    // Advisory, not a wall: one action, and it dismisses.
    await expect(dialog.getByRole("button", { name: /got it/i })).toBeVisible()
    // The /login-era escape hatch is gone — past sign-in it was a dead end into
    // the marketing site.
    await expect(dialog.getByRole("link", { name: /back to home/i })).toHaveCount(0)
  })

  test("dismissing reveals the workspace and does not return while navigating", async ({
    page,
  }) => {
    await page.goto("/projects")

    const dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: /got it/i }).click()
    await expect(dialog).toBeHidden()

    // Once per login, not once per page: moving deeper into the app must not
    // re-prompt. The gate is mounted outside the keyed <Outlet> precisely so a
    // route change (or a membership resync) leaves its state alone.
    await page.goto(channelUrl(seed))
    await expect(page.getByRole("dialog")).toBeHidden()

    await page.goto("/my-tasks")
    await expect(page.getByRole("dialog")).toBeHidden()
  })

  test("returns on a fresh load of the app", async ({ page }) => {
    await page.goto("/projects")
    await page.getByRole("dialog").getByRole("button", { name: /got it/i }).click()
    await expect(page.getByRole("dialog")).toBeHidden()

    // Dismissal is mount-scoped state, deliberately not persisted to storage —
    // a reload remounts the authenticated layout, so the notice is due again.
    // The earlier sessionStorage version stayed silent here for the whole tab.
    await page.reload()
    await expect(page.getByRole("dialog")).toBeVisible()
  })

  test("a deep-linked channel raises it too", async ({ page }) => {
    // Cold deep-link, no /projects first: the gate is on the layout, so every
    // authenticated entry point is covered without per-route wiring.
    await page.goto(channelUrl(seed))
    await expect(page.getByRole("dialog")).toBeVisible()
  })
})
