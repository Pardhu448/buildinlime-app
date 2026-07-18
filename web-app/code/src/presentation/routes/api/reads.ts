import { createFileRoute } from "@tanstack/react-router"
import { shapeHandler } from "../../../infrastructure/database/shape-route"
import { readsShape } from "../../../infrastructure/database/shapes"

// Authorization rule lives in infrastructure/database/shapes.ts → readsShape.
export const Route = createFileRoute("/api/reads")({
  server: { handlers: { GET: shapeHandler(readsShape) } },
})
