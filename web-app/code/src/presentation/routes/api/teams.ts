import { createFileRoute } from "@tanstack/react-router"
import { shapeHandler } from "../../../infrastructure/database/shape-route"
import { teamsShape } from "../../../infrastructure/database/shapes"

// Authorization rule lives in infrastructure/database/shapes.ts → teamsShape.
export const Route = createFileRoute("/api/teams")({
  server: { handlers: { GET: shapeHandler(teamsShape) } },
})
