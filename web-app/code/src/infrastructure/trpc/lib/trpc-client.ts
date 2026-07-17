import { createTRPCProxyClient, httpBatchLink } from "@trpc/client"
import type { AppRouter } from "%/infrastructure/trpc/routers/index"

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `/api/trpc`,
      async headers() {
        return {
          cookie: typeof document !== `undefined` ? document.cookie : ``,
        }
      },
    }),
  ],
})
