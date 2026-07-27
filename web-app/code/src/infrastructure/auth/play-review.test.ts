import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * The module reads env once at load, so each case has to re-import it under a
 * fresh env. resetModules + dynamic import is the only way to exercise the
 * boot-time branches (including the throw) from a test.
 */
async function loadWith(env: Record<string, string | undefined>) {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) vi.stubEnv(key, "")
    else vi.stubEnv(key, value)
  }
  return await import("./play-review")
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

/**
 * A throwaway fixture, deliberately NOT the real reviewer code — that one lives
 * in the server env and the Play Console and must never be committed. Anything
 * six digits exercises the same paths.
 */
const REVIEW_ENV = {
  PLAY_REVIEW_EMAIL: "googleplayreview@gmail.com",
  PLAY_REVIEW_OTP: "424242",
}

describe("play review bypass — enabled", () => {
  it("returns the fixed code for the reviewer's sign-in", async () => {
    const m = await loadWith(REVIEW_ENV)
    expect(m.isPlayReviewEnabled).toBe(true)
    expect(m.playReviewOtpFor("googleplayreview@gmail.com", "sign-in")).toBe("424242")
  })

  it("matches case-insensitively", async () => {
    // The address Google was given is mixed-case (googlePlayReview@gmail.com)
    // while better-auth lowercases before calling generateOTP. If either side
    // were compared raw, the reviewer would get a random code mailed to an
    // inbox they cannot read, and the bypass would look like it simply does not
    // work — with nothing in the logs to say why.
    const m = await loadWith({
      ...REVIEW_ENV,
      PLAY_REVIEW_EMAIL: "googlePlayReview@gmail.com",
    })
    expect(m.playReviewOtpFor("googleplayreview@gmail.com", "sign-in")).toBe("424242")
    expect(m.playReviewOtpFor("GOOGLEPLAYREVIEW@GMAIL.COM", "sign-in")).toBe("424242")
  })

  it("tolerates surrounding whitespace in the env value", async () => {
    const m = await loadWith({
      PLAY_REVIEW_EMAIL: "  googleplayreview@gmail.com  ",
      PLAY_REVIEW_OTP: " 424242 ",
    })
    expect(m.playReviewOtpFor("googleplayreview@gmail.com", "sign-in")).toBe("424242")
  })

  it("leaves every other address on the random generator", async () => {
    const m = await loadWith(REVIEW_ENV)
    expect(m.playReviewOtpFor("someone@example.com", "sign-in")).toBeUndefined()
    expect(m.isPlayReviewEmail("someone@example.com")).toBe(false)
  })

  it("does not apply outside sign-in", async () => {
    const m = await loadWith(REVIEW_ENV)
    expect(
      m.playReviewOtpFor("googleplayreview@gmail.com", "email-verification")
    ).toBeUndefined()
    expect(
      m.playReviewOtpFor("googleplayreview@gmail.com", "change-email")
    ).toBeUndefined()
  })
})

describe("play review bypass — disabled", () => {
  it("is inert when neither var is set", async () => {
    const m = await loadWith({ PLAY_REVIEW_EMAIL: undefined, PLAY_REVIEW_OTP: undefined })
    expect(m.isPlayReviewEnabled).toBe(false)
    expect(m.playReviewOtpFor("googleplayreview@gmail.com", "sign-in")).toBeUndefined()
    expect(m.isPlayReviewEmail("googleplayreview@gmail.com")).toBe(false)
  })

  it("is inert when only the email is set", async () => {
    // Half-configured must mean off, not "bypass with an empty code".
    const m = await loadWith({ ...REVIEW_ENV, PLAY_REVIEW_OTP: undefined })
    expect(m.isPlayReviewEnabled).toBe(false)
    expect(m.playReviewOtpFor("googleplayreview@gmail.com", "sign-in")).toBeUndefined()
  })

  it("is inert when only the code is set", async () => {
    const m = await loadWith({ ...REVIEW_ENV, PLAY_REVIEW_EMAIL: undefined })
    expect(m.isPlayReviewEnabled).toBe(false)
  })
})

describe("play review bypass — misconfiguration", () => {
  it.each(["12345", "1234567", "69698a", "abcdef"])(
    "refuses to boot with a non-6-digit code (%s)",
    async (otp) => {
      await expect(loadWith({ ...REVIEW_ENV, PLAY_REVIEW_OTP: otp })).rejects.toThrow(
        /must be exactly 6 digits/
      )
    }
  )
})
