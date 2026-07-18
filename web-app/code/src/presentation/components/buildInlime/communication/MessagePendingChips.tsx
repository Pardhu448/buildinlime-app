import { Loader, RefreshCw } from "lucide-react"
import { ResourceThumbnail } from "./ResourceThumbnail"
import type { PendingResource } from "%/application/hooks/use-pending-resources"

export interface MessagePendingChipsProps {
  /** In-flight uploads belonging to a single message. */
  pending: PendingResource[]
  onRetry: (id: string) => void
}

/**
 * Optimistic chips for a message's attachments while they upload. Once a
 * resource lands it syncs back as a real row and is rendered by
 * `MessageResourceDisplay` instead — these chips only cover the in-flight window.
 */
export function MessagePendingChips({ pending, onRetry }: MessagePendingChipsProps) {
  if (pending.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {pending.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-1.5 px-2 py-1 bg-white border border-card-border rounded text-xs text-muted-foreground"
        >
          {/* Spinners stay while the upload is in flight — status beats a
              preview there. Once it settles (or fails) the local blob is
              shown, so you see the actual file rather than a mime glyph. */}
          {r.status === "uploading" ? (
            <Loader className="w-3 h-3 animate-spin shrink-0" />
          ) : r.status === "awaiting_network" ? (
            <Loader className="w-3 h-3 animate-spin shrink-0 text-primary" />
          ) : (
            <ResourceThumbnail localUrl={r.objectUrl} mimeType={r.file.type} size={20} />
          )}
          <span
            className="max-w-[140px] truncate"
            title={r.status === "awaiting_network" ? "Will upload when back online" : undefined}
          >
            {r.name}
          </span>
          {r.status === "awaiting_network" && (
            <span className="text-primary shrink-0">Waiting for network…</span>
          )}
          {r.status === "error" && (
            <>
              <span className="text-red-500 shrink-0">Failed</span>
              <button
                onClick={() => onRetry(r.id)}
                title="Retry upload"
                className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
