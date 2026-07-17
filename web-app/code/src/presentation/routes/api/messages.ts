import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"
import { idListWhere, parseIdList } from "../../../infrastructure/database/shape-where"

const serve = async ({ request }: { request: Request }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const url = new URL(request.url)
  const channelIds = parseIdList(url.searchParams.get(`member_channel_ids`))

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set(`table`, `messages`)
  // DELIBERATELY NO `AND deleted_at IS NULL` HERE — unlike tasks and resources.
  //
  // Replies hang off a message via parent_id, and the client builds its thread list
  // from roots and buckets the rest under their parent. Drop a deleted parent out of
  // the shape and its replies are orphaned: they are not roots, their parent renders
  // nowhere, and an entire conversation silently disappears. So a deleted message
  // keeps syncing, and the client renders a tombstone from deleted_at.
  //
  // Nothing sensitive rides along: messages.delete REDACTS the row in place (text,
  // mention_ids and resource_ids are cleared server-side), so what syncs is an empty
  // tombstone, not the words. Adding the filter here would look like a tightening and
  // would in fact destroy threads.
  originUrl.searchParams.set(`where`, idListWhere(`channel_id`, channelIds))

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute("/api/messages")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
