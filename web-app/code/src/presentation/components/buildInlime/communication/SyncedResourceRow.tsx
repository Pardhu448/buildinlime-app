import { Download, X } from "lucide-react"
import { ResourceThumbnail } from "./ResourceThumbnail"
import { formatDateTime } from "%/presentation/lib/datetime"
import { formatBytes } from "%/presentation/lib/format-bytes"

/** A resource that has synced through Electric — visible to every client. */
export type SyncedResource = {
  id: string
  name: string
  description?: string | null
  file_location: string
  mime_type: string
  uploaded_at: string | Date
  file_size_bytes: number | bigint
  createdby_id: string
}

export interface SyncedResourceRowProps {
  resource: SyncedResource
  canDelete: boolean
  onDelete: (id: string) => void
}

export function SyncedResourceRow({ resource: r, canDelete, onDelete }: SyncedResourceRowProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-card-surface border border-card-border rounded hover:bg-icon-chip transition-colors">
      <ResourceThumbnail fileLocation={r.file_location} mimeType={r.mime_type} size={36} />

      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate">{r.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {formatDateTime(r.uploaded_at)}
          {` · ${formatBytes(r.file_size_bytes)}`}
          {r.description ? ` · ${r.description}` : ""}
        </p>
      </div>

      {/* Download from server */}
      <a
        href={r.file_location}
        download
        title="Download"
        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
      </a>

      {/* Delete — uploader, or the creator of the task this file hangs off.
          The server enforces it (FORBIDDEN otherwise); hiding the button is
          courtesy, not the control. It used to render unconditionally, so
          deleting someone else's file optimistically removed the row and then
          snapped it back when the server refused, with nothing shown. */}
      {canDelete && (
        <button
          onClick={() => onDelete(r.id)}
          title="Delete resource"
          className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
