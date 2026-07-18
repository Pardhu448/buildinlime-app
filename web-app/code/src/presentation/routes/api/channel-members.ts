import { createFileRoute } from "@tanstack/react-router"
import { shapeHandler } from "../../../infrastructure/database/shape-route"
import { channelMembersShape } from "../../../infrastructure/database/shapes"

// Authorization rule lives in infrastructure/database/shapes.ts → channelMembersShape.
export const Route = createFileRoute("/api/channel-members")({
  server: { handlers: { GET: shapeHandler(channelMembersShape) } },
})
