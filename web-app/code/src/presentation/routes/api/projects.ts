import { createFileRoute } from "@tanstack/react-router"
import { shapeHandler } from "../../../infrastructure/database/shape-route"
import { projectsShape } from "../../../infrastructure/database/shapes"

// Authorization rule lives in infrastructure/database/shapes.ts → projectsShape.
export const Route = createFileRoute("/api/projects")({
  server: { handlers: { GET: shapeHandler(projectsShape) } },
})
