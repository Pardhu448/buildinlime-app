import { createFileRoute } from "@tanstack/react-router"
import { handleFileUpload } from "%/infrastructure/storage/fileStorage"

export const Route = createFileRoute("/api/resources/upload")({
  server: {
    handlers: {
      POST: ({ request }) => handleFileUpload(request),
    },
  },
})
