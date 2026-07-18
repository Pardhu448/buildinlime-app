import { createFileRoute } from "@tanstack/react-router"
import { shapeHandler } from "../../../infrastructure/database/shape-route"
import { membershipsShape } from "../../../infrastructure/database/shapes"

// Authorization rule lives in infrastructure/database/shapes.ts → membershipsShape.
export const Route = createFileRoute("/api/memberships")({
  server: { handlers: { GET: shapeHandler(membershipsShape) } },
})
