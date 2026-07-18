import { createFileRoute } from "@tanstack/react-router"
import { shapeHandler } from "../../../infrastructure/database/shape-route"
import { buildUnitsShape } from "../../../infrastructure/database/shapes"

// Authorization rule lives in infrastructure/database/shapes.ts → buildUnitsShape.
export const Route = createFileRoute("/api/buildunits")({
  server: { handlers: { GET: shapeHandler(buildUnitsShape) } },
})
