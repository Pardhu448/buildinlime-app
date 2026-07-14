import { createTRPCProxyClient, httpBatchLink } from "@trpc/client"
import { createCookieFetch } from "../auth/cookie-fetch"

// TODO: Import AppRouter from the web codebase once type-sharing is set up.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppRouter = any

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"

// TEMP DEBUG (network-stall investigation): confirm the URL this singleton is
// pinned to. A stale value here (old LAN IP) after an env change means the
// module wasn't re-evaluated — do a full reload, not Fast Refresh. Remove once resolved.
console.log(`>>> TRPC API URL: ${apiUrl}/api/trpc`)

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
