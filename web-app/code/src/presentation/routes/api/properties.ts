import { createFileRoute } from "@tanstack/react-router"
import { shapeHandler } from "../../../infrastructure/database/shape-route"
import { propertiesShape } from "../../../infrastructure/database/shapes"

// Authorization rule lives in infrastructure/database/shapes.ts → propertiesShape.
export const Route = createFileRoute("/api/properties")({
  server: { handlers: { GET: shapeHandler(propertiesShape) } },
})
