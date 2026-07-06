import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { emailOTP } from "better-auth/plugins"
import { db } from "../database/connection"
import { accounts, sessions, users, verifications } from "../database/schema/auth-schema"
import { sendVerificationOtp } from "../lib/utils/sendEmailOtp"

/**
 * Better Auth Server Configuration
 * 
 * Required environment variables:
 * - BETTER_AUTH_SECRET (min 32 chars): Encryption secret
 * - BETTER_AUTH_URL: Base URL of the application
 */
export const auth = betterAuth({
  // Database adapter using Drizzle ORM
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  
  // Email OTP plugin for passwordless authentication
  plugins: [
    emailOTP({
      overrideDefaultEmailVerification: true,
      disableSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        // TODO: Implement actual email sending
        // Options: Resend, SendGrid, AWS SES, Nodemailer, etc.
        //console.log(`OTP for ${email} (${type}): ${otp}`)
        await sendVerificationOtp({ email, otp, type })
      },
      otpLength: 6,
      expiresIn: 300,
      sendVerificationOnSignUp: true,
      allowedAttempts: 5,
    }),
  ],
  
  // Session configuration
  session: {
    // How long until the session expires (default: 2 days)
    expiresIn: 60 * 60 * 24 * 2,
    // Update session cookie after this time (default: 24 hours)
    updateAge: 60 * 60 * 24,
    // Store sessions in database (recommended for production)
    storeSessionInDatabase: true,
    // Serve the session from a signed cookie for up to `maxAge` seconds so
    // getSession skips the DB on the hot path. The Electric shape routes call
    // getSession on every long-poll across every collection, so this takes the
    // per-poll session read off the critical path (reduction ~= maxAge / poll
    // interval; with ~20s long-polls, 50s ≈ 3x fewer session DB reads).
    //
    // SECURITY TRADEOFF — session-revocation lag (accepted for now, POC):
    // While a cached cookie is valid, getSession trusts it WITHOUT consulting
    // the DB, so anything that revokes a session server-side is delayed by up
    // to maxAge. In a sync app this means a de-authorized identity can keep
    // streaming Electric data for up to ~maxAge. Blast radius is limited here
    // because authorization is membership/ownership-driven (checked server-side
    // per shape and re-verified against the DB in tRPC mutations) and the
    // session only vouches for the immutable user id — a stale cookie cannot
    // ELEVATE privileges, only extend an already-authenticated identity.
    //
    // The cache uses better-auth's default `compact` strategy: the payload is
    // HMAC-SIGNED (tamper-proof) but NOT encrypted, so it is readable by anyone
    // who obtains the cookie. It is httpOnly (not JS/XSS-readable) and carries
    // only identity, so this is acceptable; switch strategy to `jwe` if the
    // payload ever needs confidentiality.
    //
    // FUTURE WORK — the severe edge cases where the lag matters and should be
    // hardened before this is treated as production-grade:
    //   1. Account ban / disable and "sign out everywhere" — revoked user keeps
    //      access for up to maxAge. Consider a fast revocation path or
    //      bypassing the cache (disableCookieCache) for these flows. Bumping
    //      `cookieCache.version` invalidates ALL cached sessions immediately and
    //      is the blunt global escape hatch.
    //   2. Password reset after credential compromise — old sessions stay valid
    //      for up to maxAge.
    //   3. Account deletion / email change (both enabled below) — force fresh
    //      session validation on these actions rather than trusting the cache.
    //   4. BETTER_AUTH_SECRET is now the sole integrity backstop (no DB check
    //      within the TTL) — ensure it stays >=32 chars, high-entropy, secret,
    //      and rotate on any suspected exposure.
    cookieCache: { enabled: true, maxAge: 50 },
  },
  
  // User configuration
  user: {
    // Allow users to change their email
    changeEmail: {
      enabled: true,
    },
    // Allow users to delete their account
    deleteUser: {
      enabled: true,
    },
  },
  
  // Account configuration
  account: {
    // Allow account linking
    accountLinking: {
      enabled: true,
    },
  },
  
  // Security settings
  advanced: {
    // Use secure cookies (HTTPS only in production)
    useSecureCookies: process.env.NODE_ENV === "production",
    // Generate numeric IDs instead of UUIDs
    generateId: "uuid",
  },
  
  // Trusted origins for CSRF protection
  // NOTE: Caddy serves HTTPS at localhost:5173, proxying to the app on port 3000.
  // Both the Caddy HTTPS origin and the internal port must be trusted.
  // Set MOBILE_ORIGIN to a comma-separated list to trust dev-machine LAN
  // origins (e.g. "http://192.168.1.15:3000,exp://192.168.1.15:8081").
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "https://localhost:5173",
    "http://localhost:3000",
    "http://10.0.2.2:3000",
    ...(process.env.MOBILE_ORIGIN?.split(",").map((o) => o.trim()).filter(Boolean) ?? []),
  ],
  
  // Cookie configuration
  cookiePrefix: "better-auth",
})

// Export type for TypeScript support
export type Auth = typeof auth
