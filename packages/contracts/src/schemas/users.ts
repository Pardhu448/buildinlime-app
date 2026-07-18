import { z } from "zod"

/**
 * `users.checkEmail` — the pre-sign-in lookup the mobile login screen makes to
 * decide whether to offer sign-in or registration.
 *
 * Lives here rather than inline in the server router because mobile calls this
 * procedure, so it belongs to the shared wire contract: the contract router
 * mirrors it, and both sides validate against this one schema. It was previously
 * declared inline on the server and omitted from the contract as "web-only",
 * which left mobile's call untyped (`Property 'users' does not exist on type
 * TRPCClient<...>`) — the exact drift the contract exists to prevent.
 */
export const checkEmailInput = z.object({ email: z.string().email() })
