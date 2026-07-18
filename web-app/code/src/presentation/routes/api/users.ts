import { createFileRoute } from "@tanstack/react-router"
import { shapeHandler } from "../../../infrastructure/database/shape-route"
import { usersShape } from "../../../infrastructure/database/shapes"

// Authorization rule lives in infrastructure/database/shapes.ts → usersShape.
export const Route = createFileRoute("/api/users")({
  server: { handlers: { GET: shapeHandler(usersShape) } },
})
