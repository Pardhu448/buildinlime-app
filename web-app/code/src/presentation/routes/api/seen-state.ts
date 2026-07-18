import { createFileRoute } from "@tanstack/react-router"
import { shapeHandler } from "../../../infrastructure/database/shape-route"
import { seenStateShape } from "../../../infrastructure/database/shapes"

// Authorization rule lives in infrastructure/database/shapes.ts → seenStateShape.
export const Route = createFileRoute("/api/seen-state")({
  server: { handlers: { GET: shapeHandler(seenStateShape) } },
})
