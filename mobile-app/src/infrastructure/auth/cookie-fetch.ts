import * as SecureStore from "expo-secure-store"

const SECURE_STORE_KEY = "better_auth_cookies"

// Better Auth requires an Origin header on all state-changing requests (CSRF protection).
// React Native fetch doesn't send Origin automatically, so we inject it manually.
// We derive it from EXPO_PUBLIC_API_URL so it matches the server's trustedOrigins.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"
const ORIGIN = new URL(API_URL).origin

type CookieMap = Record<string, string>

// ---------------------------------------------------------------------------
// In-memory cookie jar.
//
// The jar is the single source of truth in memory; SecureStore is only its
// durable backing. The previous implementation went to SecureStore on EVERY
// request — a decrypt-read before each fetch (getAuthHeaders) AND a read+write
// after every Set-Cookie response, with the response held OPEN until that
// encrypted write finished. On the sync hot path that is wasteful: the app holds
// 13 Electric long-polls open, each re-issues every ~20s, and Better Auth's
// cookieCache (maxAge 50) re-stamps Set-Cookie on them regularly — so every
// shape response paid for a serialized Android-Keystore round trip.
//
// Fix: read SecureStore ONCE, serve every request from memory, and write back
// only when a cookie value actually changes — serialized and OFF the response's
// critical path, so a shape response never waits on the encrypted store again.
//
// This was written while chasing the disappearing-message bug, on the theory
// that the keystore churn was stalling shape responses badly enough to wedge
// sync. It was NOT the cause (see DISAPPEARING_MESSAGES_INVESTIGATION.md §11 —
// RN's AbortController has no `signal.reason`), and it is kept purely as the
// efficiency win it turned out to be.
// ---------------------------------------------------------------------------

let cache: CookieMap | null = null
let loadOnce: Promise<CookieMap> | null = null
// Serialize writes so overlapping Set-Cookie responses can't lost-update the jar
// or run concurrent SecureStore writes over each other.
let writeChain: Promise<void> = Promise.resolve()

async function ensureLoaded(): Promise<CookieMap> {
  if (cache) return cache
  if (!loadOnce) {
    loadOnce = (async () => {
      try {
        const raw = await SecureStore.getItemAsync(SECURE_STORE_KEY)
        cache = raw ? (JSON.parse(raw) as CookieMap) : {}
      } catch {
        cache = {}
      }
      return cache
    })()
  }
  return loadOnce
}

// Update the in-memory jar immediately, then persist in the background. Never
// awaited by a request, so an encrypted write can't hold a response open.
function persist(next: CookieMap): void {
  cache = next
  const snapshot = JSON.stringify(next)
  writeChain = writeChain
    .then(() => SecureStore.setItemAsync(SECURE_STORE_KEY, snapshot))
    .catch(() => {})
}

export async function clearAuthCookies(): Promise<void> {
  cache = {}
  writeChain = writeChain
    .then(() => SecureStore.deleteItemAsync(SECURE_STORE_KEY))
    .catch(() => {})
  await writeChain
}

/** Returns the stored session cookies as a Cookie header string. */
export async function getAuthCookieHeader(): Promise<string> {
  const cookieMap = await ensureLoaded()
  return Object.entries(cookieMap)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ")
}

/**
 * Auth headers (session cookie + Origin) for requests that CANNOT go through
 * createCookieFetch — e.g. FileSystem.downloadAsync / uploadAsync, which take
 * a plain headers map and do their own native networking. Keeping this as the
 * single header-builder means cookieFetch and the file-transfer paths can't
 * drift apart on what auth headers they send.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Origin: ORIGIN }
  const cookieHeader = await getAuthCookieHeader()
  if (cookieHeader) headers.Cookie = cookieHeader
  return headers
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
 * request and persists any Set-Cookie values from every response. All instances
 * share the module-level in-memory jar, so the Electric fetchClient, the upload
 * manager and getAuthHeaders can never drift apart on the current cookies.
 */
// DIAGNOSTIC (dev-only): count in-flight requests through the shared fetch and
// time each one. Every Electric shape long-poll and every upload passes through
// here, so a sync freeze shows up as shape polls that stop being re-issued, or
// an in-flight count that climbs and stays pinned. Remove once the disappearing-
// message bug is resolved.
let netInFlight = 0
let netSeq = 0
function shortPath(input: RequestInfo | URL): string {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url
  return url.replace(API_URL, "").split("?")[0]
}

export function createCookieFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // 1. Attach stored cookies + Origin (the latter so Better Auth's CSRF
    //    check passes in React Native). Served from memory after the first load.
    const headers = new Headers(init?.headers)
    for (const [key, value] of Object.entries(await getAuthHeaders())) {
      headers.set(key, value)
    }

    // 2. Make the actual request
    const id = ++netSeq
    netInFlight++
    const t0 = Date.now()
    if (__DEV__) console.log(`[net#${id}] → ${init?.method ?? "GET"} ${shortPath(input)} (inflight ${netInFlight})`)
    let response: Response
    try {
      response = await fetch(input, { ...init, headers })
    } catch (err) {
      netInFlight--
      if (__DEV__) console.log(`[net#${id}] ✗ ${shortPath(input)} THREW after ${Date.now() - t0}ms (inflight ${netInFlight}):`, String(err))
      throw err
    }
    netInFlight--
    if (__DEV__) console.log(`[net#${id}] ← ${shortPath(input)} ${response.status} ${Date.now() - t0}ms (inflight ${netInFlight})`)

    // 3. Persist any Set-Cookie values — but only when something actually
    //    changed, and never blocking the response on the write.
    // In React Native, Headers.getAll is not available; we use get() which
    // returns a comma-joined string for multi-value headers, but Set-Cookie
    // values can contain commas in Expires dates. Better Auth typically sends
    // one session cookie, so we handle the common case.
    const setCookieRaw = response.headers.get("set-cookie")
    if (setCookieRaw) {
      const current = await ensureLoaded()
      const next = { ...current }
      let changed = false
      // Split on ", " only when followed by a cookie name (word=)
      const cookieStrings = setCookieRaw.split(/,(?=[^;]+=)/)
      for (const cookieStr of cookieStrings) {
        const parsed = parseSetCookieHeader(cookieStr.trim())
        if (parsed && next[parsed.name] !== parsed.value) {
          next[parsed.name] = parsed.value
          changed = true
        }
      }
      if (changed) persist(next)
    }

    return response
  }
}
