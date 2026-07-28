import { describe, it, expect } from "vitest"
import { signupUrl, signupBaseUrl } from "@/src/infrastructure/auth/signup-url"

// The mobile app has no signup screen — accounts are made on the web — so a
// failed users.checkEmail lookup hands off to the browser. These cover the
// handoff URL, which is the whole of that contract with the web /login route:
// `mode=signup` selects the form, `email` prefills it.

describe("signupUrl", () => {
  it("selects the signup form and carries the address", () => {
    const url = new URL(signupUrl("someone@example.com"))
    expect(url.pathname).toBe("/login")
    expect(url.searchParams.get("mode")).toBe("signup")
    expect(url.searchParams.get("email")).toBe("someone@example.com")
  })

  // The reason this is a module and not an inline template literal. `+` is legal
  // in a local part and is what Gmail's tag addressing uses; unencoded it decodes
  // as a SPACE on the web side, silently prefilling a different address than the
  // one the user typed and was told had no account.
  it("encodes a + in the local part rather than letting it decode as a space", () => {
    const url = signupUrl("someone+build@example.com")
    expect(url).toContain("email=someone%2Bbuild%40example.com")
    expect(new URL(url).searchParams.get("email")).toBe("someone+build@example.com")
  })

  it("encodes the other characters that would break the query string", () => {
    const url = new URL(signupUrl("a&b=c@example.com"))
    expect(url.searchParams.get("email")).toBe("a&b=c@example.com")
    // The & must not have split the query into an extra parameter.
    expect([...url.searchParams.keys()].sort()).toEqual(["email", "mode"])
  })

  it("trims surrounding whitespace, which a phone keyboard readily adds", () => {
    expect(new URL(signupUrl("  someone@example.com ")).searchParams.get("email")).toBe(
      "someone@example.com",
    )
  })

  // Defensive: the screen only offers the handoff once checkEmail has answered
  // for a non-empty address, but an empty `email=` would prefill the web form
  // with nothing while looking deliberate. Omit the parameter instead.
  it("omits the email parameter entirely when there is no address", () => {
    const url = new URL(signupUrl("   "))
    expect(url.searchParams.has("email")).toBe(false)
    expect(url.searchParams.get("mode")).toBe("signup")
  })

  it("points at the same origin the API clients use", () => {
    expect(signupUrl("someone@example.com").startsWith(signupBaseUrl)).toBe(true)
    expect(signupBaseUrl.endsWith("/login")).toBe(true)
  })
})
