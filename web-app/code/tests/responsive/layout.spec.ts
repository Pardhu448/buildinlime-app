import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"

// Every public marketing route. Kept as a literal list rather than derived from
// the router so that adding a page is a deliberate decision to cover it.
const MARKETING_ROUTES = [
  "/",
  "/about",
  "/features",
  "/pricing",
  "/resources",
  "/blog",
  "/documentation",
  "/get-started",
  "/support",
  "/contact",
  "/privacy",
  "/login?returnTo=%2F&mode=login",
] as const

// The single highest-value assertion in this file. Horizontal overflow is the
// symptom of essentially every fixed-width regression — a stray `px-[120px]`, a
// `w-[560px]` image, a `grid-cols-2` that never collapses — and unlike a visual
// diff it has no false positives and needs no baseline to maintain.
//
// The 1px tolerance absorbs sub-pixel rounding at fractional device pixel
// ratios, where scrollWidth rounds up and clientWidth rounds down on a layout
// that genuinely fits.
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      // Naming the widest offender turns "the page overflows" into something
      // directly actionable, which matters because the culprit is usually one
      // element deep in a section that looks fine at desktop width.
      widest: (() => {
        let worst = { tag: "", cls: "", right: 0 }
        for (const node of Array.from(document.querySelectorAll("*"))) {
          const r = node.getBoundingClientRect()
          if (r.right > worst.right) {
            worst = {
              tag: node.tagName.toLowerCase(),
              // SVG elements carry an SVGAnimatedString here rather than a
              // string, so this is stringified rather than read directly.
              cls: String((node as HTMLElement).className).slice(0, 120),
              right: Math.round(r.right),
            }
          }
        }
        return worst
      })(),
    }
  })

  expect(
    overflow.scrollWidth,
    `page scrolls horizontally (${overflow.scrollWidth}px content in a ` +
      `${overflow.clientWidth}px viewport). Widest element: ` +
      `<${overflow.widest.tag} class="${overflow.widest.cls}"> ` +
      `reaching x=${overflow.widest.right}px`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1)
}

for (const route of MARKETING_ROUTES) {
  test(`${route} does not scroll horizontally`, async ({ page }) => {
    await page.goto(route)
    // Fonts change text metrics and can be what pushes a line past the edge, so
    // measuring before they land would let a real overflow through.
    await page.evaluate(() => document.fonts.ready)
    await expectNoHorizontalOverflow(page)
  })
}

test.describe("mobile-only behaviour", () => {
  // The desktop project renders the full nav and no hamburger, so these would
  // fail there for the right reason — skip rather than assert the inverse, which
  // would duplicate the desktop-nav test below.
  test.skip(
    ({ isMobile }) => !isMobile,
    "covers the sub-lg layout only",
  )

  test("marketing nav collapses into a menu that opens and closes", async ({
    page,
  }) => {
    await page.goto("/")

    const toggle = page.getByRole("button", { name: /open menu/i })
    await expect(toggle).toBeVisible()

    // Closed by default — the links must not be reachable before opening.
    const panel = page.getByRole("navigation", { name: /mobile/i })
    await expect(panel).toBeHidden()

    await toggle.click()
    await expect(panel).toBeVisible()
    await expect(panel.getByRole("link", { name: "Pricing" })).toBeVisible()

    await page.getByRole("button", { name: /close menu/i }).click()
    await expect(panel).toBeHidden()
  })

  test("tapping Login shows the desktop-recommended notice instead of navigating", async ({
    page,
  }) => {
    await page.goto("/")

    await page.getByRole("button", { name: /open menu/i }).click()
    await page.getByRole("navigation", { name: /mobile/i }).getByRole("link", { name: "Login" }).click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(/desktop/i)

    // The notice is advisory, not a wall: continuing must still reach /login.
    await dialog.getByRole("link", { name: /continue/i }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test("the notice stays dismissed for the rest of the session", async ({
    page,
  }) => {
    await page.goto("/")
    await page.getByRole("button", { name: /open menu/i }).click()
    await page
      .getByRole("navigation", { name: /mobile/i })
      .getByRole("link", { name: "Login" })
      .click()

    await page.getByRole("button", { name: /dismiss|not now/i }).click()
    await expect(page.getByRole("dialog")).toBeHidden()

    // Second attempt: the user already made the call, so do not ask again —
    // go straight to /login.
    await page.getByRole("button", { name: /open menu/i }).click()
    await page
      .getByRole("navigation", { name: /mobile/i })
      .getByRole("link", { name: "Login" })
      .click()
    await expect(page).toHaveURL(/\/login/)
  })

  test("tap targets on the header meet the 44px minimum", async ({ page }) => {
    await page.goto("/")

    const toggle = page.getByRole("button", { name: /open menu/i })
    const box = await toggle.boundingBox()
    expect(box, "menu toggle has no layout box").not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.width).toBeGreaterThanOrEqual(44)
  })
})

test.describe("desktop is unchanged", () => {
  test.skip(({ isMobile }) => isMobile, "covers the lg: and up layout only")

  test("the full nav is visible and there is no hamburger", async ({ page }) => {
    await page.goto("/")

    for (const label of ["About", "Resources", "Get Started", "Pricing"]) {
      await expect(page.getByRole("link", { name: label }).first()).toBeVisible()
    }
    await expect(page.getByRole("button", { name: /open menu/i })).toBeHidden()
  })

  test("tapping Login navigates straight through, with no notice", async ({
    page,
  }) => {
    await page.goto("/")
    await page.getByRole("link", { name: "Login" }).first().click()

    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole("dialog")).toBeHidden()
  })
})
