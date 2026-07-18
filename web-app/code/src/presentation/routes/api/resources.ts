import { createFileRoute } from "@tanstack/react-router"
import { shapeHandler } from "../../../infrastructure/database/shape-route"
import { resourcesShape } from "../../../infrastructure/database/shapes"

// Authorization rule lives in infrastructure/database/shapes.ts → resourcesShape.
export const Route = createFileRoute("/api/resources")({
  server: { handlers: { GET: shapeHandler(resourcesShape) } },
})
