// Same origin the tRPC and auth clients use — the web app IS the API server, so
// the signup page is served from it. Read the same way as every other consumer
// in this app (trpc/client.ts, auth/client.ts, media-source.ts, …).
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"

/** Where sign-up lives. Exported for the fallback message when no browser opens. */
export const signupBaseUrl = `${API_URL}/login`

/**
 * The web signup page, carrying the address already typed on the mobile sign-in
 * screen so it does not have to be entered twice.
 *
 * There is no signup in the mobile app — accounts are made on the web — so a
 * failed `users.checkEmail` lookup has nowhere to go inside the app. This builds
 * the handoff target for that case.
 *
 * `mode=signup` is what the web /login route's validateSearch reads to open the
 * form in signup rather than sign-in; `email` is a PREFILL only, and the web form
 * validates and submits it like any other input.
 *
 * Lives here rather than inline in the screen so the encoding is testable: an
 * address containing `+` (Gmail's tag separator, and legal in the local part)
 * would otherwise ride through as a space and prefill the wrong address.
 */
export function signupUrl(email: string): string {
  const trimmed = email.trim()
  if (!trimmed) return `${signupBaseUrl}?mode=signup`
  return `${signupBaseUrl}?mode=signup&email=${encodeURIComponent(trimmed)}`
}
