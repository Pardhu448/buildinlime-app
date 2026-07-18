// One implementation of the Electric shape-route contract (ARCHITECTURE.md §4):
// authenticate → build a `where` → proxy. Fifteen route files used to each carry
// their own copy of those three steps; they now carry only a path and a
// descriptor, and every `where` clause lives together in ./shapes.ts where they
// can be read side by side.
//
// The scope is resolved from the SESSION, never from client input. A descriptor
// that needs the caller's visible id sets declares `scope: "member"` and receives
// them; one that does not never pays for the query.

import { auth } from "../auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "./electric-proxy"
import { resolveMemberScope } from "./access-scope"
import type { MemberScope } from "./access-scope"

export type SessionCtx = {
  /** Server-issued. Safe to interpolate — same trust level as a DB-sourced id. */
  userId: string
  url: URL
}

export type MemberCtx = SessionCtx & { scope: MemberScope }

/**
 * A shape route: which table to stream, and how to scope it.
 *
 * `where` returning undefined omits the param entirely (an unscoped table —
 * only `users`). Returning a string sets it verbatim.
 */
export type ShapeDef =
  | {
      table: string
      scope?: never
      where?: (ctx: SessionCtx) => string | undefined
    }
  | {
      table: string
      /** Resolve the caller's visible channel/buildunit/project ids first. */
      scope: "member"
      where: (ctx: MemberCtx) => string
    }

export function shapeHandler(def: ShapeDef) {
  return async ({ request }: { request: Request }): Promise<Response> => {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    }

    const ctx: SessionCtx = {
      userId: session.user.id,
      url: new URL(request.url),
    }

    const where =
      def.scope === "member"
        ? def.where({ ...ctx, scope: await resolveMemberScope(ctx.userId) })
        : def.where?.(ctx)

    const originUrl = prepareElectricUrl(request.url)
    originUrl.searchParams.set(`table`, def.table)
    if (where !== undefined) originUrl.searchParams.set(`where`, where)

    return proxyElectricRequest(originUrl)
  }
}
