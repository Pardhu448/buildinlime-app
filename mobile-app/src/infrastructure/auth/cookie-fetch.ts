import * as SecureStore from "expo-secure-store"

const SECURE_STORE_KEY = "better_auth_cookies"

// Better Auth requires an Origin header on all state-changing requests (CSRF protection).
// React Native fetch doesn't send Origin automatically, so we inject it manually.
// We derive it from EXPO_PUBLIC_API_URL so it matches the server's trustedOrigins.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"
const ORIGIN = new URL(API_URL).origin

type CookieMap = Record<string, string>

async function loadCookies(): Promise<CookieMap> {
  try {
    const raw = await SecureStore.getItemAsync(SECURE_STORE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as CookieMap
  } catch {
    return {}
  }
}

async function saveCookies(cookies: CookieMap): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEY, JSON.stringify(cookies))
}

export async function clearAuthCookies(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_STORE_KEY)
}

/** Returns the stored session cookies as a Cookie header string. */
export async function getAuthCookieHeader(): Promise<string> {
  const cookieMap = await loadCookies()
  return Object.entries(cookieMap)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ")
}

/**
 * Parses a raw Set-Cookie header string into a name=value pair.
 * Strips directives like Path, HttpOnly, SameSite, Expires, Max-Age, Domain.
 */
function parseSetCookieHeader(raw: string): { name: string; value: string } | null {
  const parts = raw.split(";")
  const first = parts[0]?.trim()
  if (!first) return null
  const eqIdx = first.indexOf("=")
  if (eqIdx === -1) return null
  const name = first.slice(0, eqIdx).trim()
  const value = first.slice(eqIdx + 1).trim()
  if (!name) return null
  return { name, value }
}

/**
 * Returns a fetch-compatible function that attaches stored cookies to every
 * request and persists any Set-Cookie values from every response.
 */
export function createCookieFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // 1. Load stored cookies and build Cookie header
    const cookieMap = await loadCookies()
    const cookieHeader = Object.entries(cookieMap)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ")

    const headers = new Headers(init?.headers)
    if (cookieHeader) {
      headers.set("Cookie", cookieHeader)
    }
    // Inject Origin so Better Auth's CSRF check passes in React Native
    headers.set("Origin", ORIGIN)

    // 2. Make the actual request
    const response = await fetch(input, { ...init, headers })

    // 3. Parse Set-Cookie headers and persist them
    // In React Native, Headers.getAll is not available; we use get() which
    // returns a comma-joined string for multi-value headers, but Set-Cookie
    // values can contain commas in Expires dates. Better Auth typically sends
    // one session cookie, so we handle the common case.
    const setCookieRaw = response.headers.get("set-cookie")
    if (setCookieRaw) {
      const newCookies = await loadCookies()
      // Split on ", " only when followed by a cookie name (word=)
      // Simple heuristic: split on "; " boundaries per cookie
      const cookieStrings = setCookieRaw.split(/,(?=[^;]+=)/)
      for (const cookieStr of cookieStrings) {
        const parsed = parseSetCookieHeader(cookieStr.trim())
        if (parsed) {
          newCookies[parsed.name] = parsed.value
        }
      }
      await saveCookies(newCookies)
    }

    return response
  }
}
