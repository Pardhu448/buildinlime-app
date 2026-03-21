import { createFileRoute } from "@tanstack/react-router"
import { serveResourceFile } from "%/infrastructure/storage/fileStorage"

export const Route = createFileRoute("/api/resources/$resourceId/file")({
  server: {
    handlers: {
      GET: ({ request, params }) => serveResourceFile(request, params),
    },
  },
})
