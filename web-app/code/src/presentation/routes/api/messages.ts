import { createFileRoute } from "@tanstack/react-router"
import { shapeHandler } from "../../../infrastructure/database/shape-route"
import { messagesShape } from "../../../infrastructure/database/shapes"

// Authorization rule lives in infrastructure/database/shapes.ts → messagesShape.
export const Route = createFileRoute("/api/messages")({
  server: { handlers: { GET: shapeHandler(messagesShape) } },
})
