import { createFileRoute } from "@tanstack/react-router"
import { shapeHandler } from "../../../infrastructure/database/shape-route"
import { inboxMentionsShape } from "../../../infrastructure/database/shapes"

// Authorization rule lives in infrastructure/database/shapes.ts → inboxMentionsShape.
export const Route = createFileRoute("/api/inbox-mentions")({
  server: { handlers: { GET: shapeHandler(inboxMentionsShape) } },
})
