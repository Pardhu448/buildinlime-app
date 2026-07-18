import { createFileRoute } from "@tanstack/react-router"
import { shapeHandler } from "../../../infrastructure/database/shape-route"
import { tasksShape } from "../../../infrastructure/database/shapes"

// Authorization rule lives in infrastructure/database/shapes.ts → tasksShape.
export const Route = createFileRoute("/api/tasks")({
  server: { handlers: { GET: shapeHandler(tasksShape) } },
})
