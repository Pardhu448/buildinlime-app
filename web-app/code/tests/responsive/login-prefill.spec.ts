import { test, expect } from "@playwright/test"

// -----------------------------------------------------------------------------
// The web half of the mobile signup handoff.
//
// The mobile app has no signup screen, so when its sign-in finds no account for
// an address it sends the user here with ?mode=signup&email=… (see
// mobile-app/src/infrastructure/auth/signup-url.ts, which owns the encoding and
// is unit-tested there). What is left to prove is the receiving end: that the
// route accepts the parameter and the form is actually prefilled with it.
//
// Lives in the responsive suite because it needs no database — /login is
// unauthenticated and this never submits — which is what that config is for.
// The assertions run at every viewport, so the handoff is covered on the phone
// widths a mobile user is most likely to land on.
// -----------------------------------------------------------------------------

const emailField = "input[type=email]"

// NOTE ON VIEWPORTS. Below `lg`, the desktop-recommended notice renders over
// /login as a modal backdrop, so anything that CLICKS the form is intercepted by
// it — and dismissing does not help, because the mode toggle re-navigates, which
// remounts the page and re-raises the notice (its dismissal is mount-scoped by
// design). `fill` is unaffected: it sets the value through DOM focus rather than
// a pointer, so it reaches the field behind the backdrop.
//
// The one click-driven case is therefore desktop-only. What it checks — that the
// mode toggle carries `email` in the search params — has nothing to do with
// viewport, so nothing is lost by not repeating it at phone widths.

test.describe("signup handoff from the mobile app", () => {
  test("?mode=signup&email= opens the signup form with the address filled in", async ({
    page,
  }) => {
    await page.goto("/login?mode=signup&email=someone%40example.com")

    await expect(page.locator(emailField)).toHaveValue("someone@example.com")

    // mode=signup, not sign-in: the name field is the signup-only input, so its
    // presence is what distinguishes the two forms.
    await expect(page.getByRole("textbox", { name: /name/i })).toBeVisible()
  })

  // The case the mobile unit tests encode for: a + in the local part must arrive
  // as a +, not the space it decodes to when unescaped.
  test("a plus-addressed email survives the round trip", async ({ page }) => {
    await page.goto("/login?mode=signup&email=someone%2Bbuild%40example.com")

    await expect(page.locator(emailField)).toHaveValue("someone+build@example.com")
  })

  test("the field stays editable — prefill is a starting point, not a lock", async ({
    page,
  }) => {
    await page.goto("/login?mode=signup&email=typo%40example.com")

    const field = page.locator(emailField)
    await field.fill("corrected@example.com")
    await expect(field).toHaveValue("corrected@example.com")
  })

  test("omitting the parameter leaves the form empty, as before", async ({ page }) => {
    await page.goto("/login?mode=signup")

    await expect(page.locator(emailField)).toHaveValue("")
  })

  test.describe("mode toggle", () => {
    // See the viewport note above: the sub-lg notice intercepts the click.
    test.skip(({ isMobile }) => !!isMobile, "click-driven; covered at desktop width")

    test("the address survives switching signup -> sign in", async ({ page }) => {
      await page.goto("/login?mode=signup&email=someone%40example.com")

      // The "Back to login" toggle re-navigates with a new mode; it carries
      // `email` so the address is not lost if the form remounts.
      await page.getByRole("button", { name: /back to login/i }).click()

      await expect(page.locator(emailField)).toHaveValue("someone@example.com")
    })
  })
})
