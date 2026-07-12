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

// TEMP DEBUG (sync-stall investigation): in-flight request tracker.
//
// Hypothesis under test: React Native's HTTP stack caps concurrent requests per
// host (OkHttp Dispatcher.maxRequestsPerHost = 5 on Android; NSURLSession's
// HTTPMaximumConnectionsPerHost = 4 on iOS). The app keeps ~10 Electric live
// long-polls open at once, so those slots are permanently occupied and a tRPC
// mutation POST sits in the client's queue until one long-poll returns — which
// is why a message sent from mobile takes ~20s to reach other devices.
//
// What to look for in the Metro logs:
//   1. `inflight=` on `[net] →` lines climbing and PINNING at 5 (or 4 on iOS)
//      actually-issued requests while more are outstanding.
//   2. A `[net] ←` line for /api/trpc/messages.create with a multi-second time,
//      immediately preceded by a `[net] ←` for a shape poll — i.e. the POST
//      only ran once a slot freed.
//   3. The `[net] SLOW` block, which dumps everything that was outstanding when
//      the slow request finished, with each entry's age.
//
// If the messages.create POST instead returns in ~50ms, the hypothesis is WRONG
// and the latency is downstream (Postgres → Electric → web). Remove once resolved.
type InFlightEntry = { path: string; t0: number; live: boolean }
const _inFlight = new Map<number, InFlightEntry>()
let _reqSeq = 0

/** A request this slow is the symptom we're hunting — dump the pool state. */
const SLOW_MS = 1000

function dumpInFlight(label: string): void {
  const now = Date.now()
  const rows = [..._inFlight.values()]
    .sort((a, b) => a.t0 - b.t0)
    .map((e) => `    ${e.live ? "live" : "    "} ${now - e.t0}ms  ${e.path}`)
    .join(`\n`)
  console.log(`[net] ${label} — ${_inFlight.size} still in flight:\n${rows}`)
}

/**
 * Returns a fetch-compatible function that attaches stored cookies to every
 * request and persists any Set-Cookie values from every response.
 */
export function createCookieFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // 1. Attach stored cookies + Origin (the latter so Better Auth's CSRF
    //    check passes in React Native). Shared builder — see getAuthHeaders.
    const headers = new Headers(init?.headers)
    for (const [key, value] of Object.entries(await getAuthHeaders())) {
      headers.set(key, value)
    }

    // 2. Make the actual request
    // TEMP DEBUG (sync-stall investigation): log every shape/API request, its
    // status, and how many other API requests were outstanding alongside it —
    // see the in-flight tracker above for what the numbers mean. Remove once
    // resolved.
    const _dbgUrl =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url
    const _dbgIsApi = __DEV__ && _dbgUrl.includes("/api/") && !_dbgUrl.includes("/api/auth")
    const _dbgPath = _dbgIsApi ? _dbgUrl.replace(API_URL, "").slice(0, 140) : ""
    // Electric's live long-poll — the request we suspect is hogging the pool.
    const _dbgLive = _dbgIsApi && _dbgUrl.includes("live=true")
    const _dbgId = _dbgIsApi ? ++_reqSeq : 0
    const _dbgT0 = Date.now()
    if (_dbgIsApi) {
      _inFlight.set(_dbgId, { path: _dbgPath, t0: _dbgT0, live: _dbgLive })
      console.log(`[net] → inflight=${_inFlight.size} ${_dbgLive ? "live " : ""}${_dbgPath}`)
    }
    let response: Response
    try {
      response = await fetch(input, { ...init, headers })
    } catch (err) {
      if (_dbgIsApi) {
        _inFlight.delete(_dbgId)
        console.log(
          `[net] ✗ (${Date.now() - _dbgT0}ms) ${_dbgPath} -> ${String((err as Error)?.message ?? err)}`,
        )
      }
      throw err
    }
    if (_dbgIsApi) {
      _inFlight.delete(_dbgId)
      const elapsed = Date.now() - _dbgT0
      const utd = response.headers.get("electric-up-to-date") !== null ? " up-to-date" : ""
      console.log(
        `[net] ← ${response.status} (${elapsed}ms) inflight=${_inFlight.size}${utd} ${_dbgPath}`,
      )
      // A non-live request that took this long was almost certainly waiting for
      // a connection slot, not for the server. Show what it was waiting behind.
      if (!_dbgLive && elapsed >= SLOW_MS) {
        dumpInFlight(`SLOW ${elapsed}ms ${_dbgPath}`)
      }
    }

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
