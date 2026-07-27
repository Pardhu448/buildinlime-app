/**
 * Google Play review sign-in bypass.
 *
 * Sign-in is passwordless email OTP, so there is no password to hand Play's
 * reviewers, and `disableSignUp` means they cannot register one. Google requires
 * "reusable login credentials that can bypass" OTP/2FA, or the app is rejected:
 * https://support.google.com/googleplay/android-developer/answer/15748846
 *
 * So exactly one address gets a fixed sign-in code instead of a random one.
 *
 * Kept in its own module, separate from server.ts, because server.ts imports the
 * database connection — this needs to be unit-testable without one. The silent
 * failure it guards against (an uppercase env value never matching, so the
 * reviewer is stuck on a code that was mailed to an inbox they cannot read) is
 * exactly the kind that only a test catches.
 *
 * Scope, deliberately narrow:
 * - one email, matched case-insensitively;
 * - `sign-in` only, not email-verification or change-email;
 * - better-auth's `allowedAttempts` and `expiresIn` still apply, so the code is
 *   constant but each request still opens only a 5-minute window.
 *
 * The account this points at should hold demo data and nothing else. Rotate the
 * code once production access is granted — it does not expire on its own.
 */

export type PlayReviewConfig = {
  email: string
  otp: string
}

/**
 * Both vars must be set for the bypass to exist at all. Absent either, this
 * returns null and every code path behaves exactly as it did before — which is
 * the state every environment except production should be in.
 */
function readConfig(): PlayReviewConfig | null {
  const email = process.env.PLAY_REVIEW_EMAIL?.trim().toLowerCase()
  const otp = process.env.PLAY_REVIEW_OTP?.trim()

  if (!email || !otp) return null

  // otpLength is 6 and the mobile UI accepts 6 digits. A mismatched value would
  // not fail here, it would fail at the reviewer's login screen — the one place
  // we cannot afford to discover it.
  if (!/^\d{6}$/.test(otp)) {
    throw new Error(
      `PLAY_REVIEW_OTP must be exactly 6 digits to match otpLength; got length ${otp.length}`
    )
  }

  return { email, otp }
}

// Read once at module load so a malformed value fails at boot, not at the
// reviewer's first sign-in attempt.
const config = readConfig()

export const isPlayReviewEnabled = config !== null

/**
 * better-auth lowercases the address before calling generateOTP, but callers
 * elsewhere may not, so normalise both sides rather than relying on that.
 */
export function isPlayReviewEmail(email: string): boolean {
  if (!config) return false
  return email.trim().toLowerCase() === config.email
}

/**
 * The fixed code for the reviewer's sign-in, or undefined for everyone else.
 * undefined is meaningful to better-auth: `generateOTP(...) || defaultOTPGenerator(opts)`
 * falls through to the random generator, so returning it leaves all other
 * addresses untouched.
 */
export function playReviewOtpFor(email: string, type: string): string | undefined {
  if (!config) return undefined
  if (type !== "sign-in") return undefined
  return isPlayReviewEmail(email) ? config.otp : undefined
}
