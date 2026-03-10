import { createTRPCProxyClient, httpBatchLink } from "@trpc/client"
import { createCookieFetch } from "../auth/cookie-fetch"

// TODO: Import AppRouter from the web codebase once type-sharing is set up.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppRouter = any

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
