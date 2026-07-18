import { createFileRoute } from "@tanstack/react-router"
import { shapeHandler } from "../../../infrastructure/database/shape-route"
import { myTasksShape } from "../../../infrastructure/database/shapes"

// Authorization rule lives in infrastructure/database/shapes.ts → myTasksShape.
export const Route = createFileRoute("/api/my-tasks")({
  server: { handlers: { GET: shapeHandler(myTasksShape) } },
})
