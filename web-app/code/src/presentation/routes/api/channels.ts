import { createFileRoute } from "@tanstack/react-router"
import { shapeHandler } from "../../../infrastructure/database/shape-route"
import { channelsShape } from "../../../infrastructure/database/shapes"

// Authorization rule lives in infrastructure/database/shapes.ts → channelsShape.
export const Route = createFileRoute("/api/channels")({
  server: { handlers: { GET: shapeHandler(channelsShape) } },
})
