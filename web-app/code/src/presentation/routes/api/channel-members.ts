import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const serve = async ({ request }: { request: Request }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  // ROSTER stream — every active membership for the channels this user can see,
  // used only to display who is in a channel (member lists, add/remove UI,
  // assignee pickers). The channel set is supplied by the client (baked into
  // the shape URL, derived from the already-synced self-membership rows), so
  // this route runs NO direct DB query — it is a static-where proxy like
  // /api/projects.
  //
  // AUTHZ NOTE: this trusts client-supplied channel_ids, consistent with how
  // /api/projects, /api/buildunits and /api/channels already trust member_ids
  // (UUID-validated only, no server-side membership check). It is a shared
  // future-hardening surface — if these routes are locked down, do them all
  // together. The collection is recreated by the membership-change trigger
  // (Phase 4), the same one that rebuilds projects/build-units/channels.
  const url = new URL(request.url)
  const channelIds = (url.searchParams.get(`channel_ids`) ?? ``)
    .split(`,`)
    .filter(id => UUID_REGEX.test(id))

  // No visible channels yet → return an empty (well-formed) Electric shape by
  // filtering to a predicate that matches nothing, rather than a bare `[]`
  // body that the Electric client cannot resume from.
  const whereClause = channelIds.length > 0
    ? `channel_id = ANY(ARRAY[${channelIds.map(id => `'${id}'`).join(`,`)}]::text[]) AND member_flag = true`
    : `false`

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set(`table`, `memberships`)
  originUrl.searchParams.set(`where`, whereClause)

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute(`/api/channel-members`)({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
