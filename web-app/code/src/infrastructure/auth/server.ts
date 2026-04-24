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
