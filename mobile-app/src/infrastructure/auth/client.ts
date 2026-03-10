import { emailOTPClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"
import { clearAuthCookies, createCookieFetch } from "./cookie-fetch"

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "https://localhost:5173"
console.log(">>> AUTH API URL:", apiUrl) 
/**
 * Better Auth client for React Native.
 *
 * Uses expo-secure-store to persist session cookies across app restarts.
 * createCookieFetch() intercepts every request to attach stored cookies and
 * every response to persist new Set-Cookie values.
 */
export const authClient = createAuthClient({
  baseURL: apiUrl,
  basePath: "/api/auth",
  plugins: [emailOTPClient()],
  fetchOptions: {
    customFetchImpl: createCookieFetch(),
  },
})

export const { signIn, signOut, getSession, useSession } = authClient
export { clearAuthCookies }
