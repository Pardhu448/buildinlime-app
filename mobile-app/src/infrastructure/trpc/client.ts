import { createTRPCProxyClient, httpBatchLink } from "@trpc/client"
import type { AppRouter } from "@buildinlime/contracts"
import { createCookieFetch } from "../auth/cookie-fetch"

// AppRouter is the shared wire contract (packages/contracts), derived from the
// same zod input schemas the server validates against — so a client call that
// doesn't match the server's expected input now fails `pnpm typecheck` instead of
// silently at runtime (ARCHITECTURE.md §12.4). `import type` keeps this a
// compile-time-only dependency: no server code is pulled into the bundle.
export type { AppRouter }

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"

// Single shared instance — cookie fetch handles auth on every request
const cookieFetch = createCookieFetch()

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${apiUrl}/api/trpc`,
      fetch: cookieFetch,
    }),
  ],
})
