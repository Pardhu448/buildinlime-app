import { useRef } from "react"
import { Paperclip, X, Download } from "lucide-react"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { resourcesCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { formatDateTime } from "%/presentation/lib/datetime"
import { formatBytes } from "%/presentation/lib/format-bytes"
import { ResourceThumbnail } from "./ResourceThumbnail"

export { parseTextArray } from "%/presentation/lib/utils"

export interface PendingAttachment {
  id: string
  file: File
  objectUrl: string
}

// ── Paperclip trigger + hidden file input ──────────────────────────────────
// Renders only the button; chips are managed by the parent (CommentInput).
export function MessageAttachmentPicker({
  onAdd,
}: {
  onAdd: (attachments: PendingAttachment[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const attachments: PendingAttachment[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      objectUrl: URL.createObjectURL(file),
    }))
    if (attachments.length > 0) onAdd(attachments)
    e.target.value = ""
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleChange}
        accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="p-1.5 hover:bg-icon-chip rounded transition-colors"
        title="Attach file"
      >
        <Paperclip className="w-4 h-4 text-muted-foreground" />
      </button>
    </>
  )
}

// ── Pending file chips shown inside the compose box ────────────────────────
export function PendingAttachmentChips({
  files,
  onRemove,
}: {
  files: PendingAttachment[]
  onRemove: (id: string) => void
}) {
  if (files.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {files.map((f) => (
        <div
          key={f.id}
          className="flex items-center gap-1.5 px-2 py-1 bg-white border border-card-border rounded text-xs text-foreground"
        >
          {/* Previews straight from the local blob — the file has not been uploaded
              yet, so there is nothing to fetch. */}
          <ResourceThumbnail localUrl={f.objectUrl} mimeType={f.file.type} size={24} />
          <span className="max-w-[140px] truncate">{f.file.name}</span>
          <span className="text-muted-foreground shrink-0">{formatBytes(f.file.size)}</span>
          <button
            type="button"
            onClick={() => {
              URL.revokeObjectURL(f.objectUrl)
              onRemove(f.id)
            }}
            className="text-muted-foreground hover:text-red-500 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Synced resources attached to a message ─────────────────────────────────
export function MessageResourceDisplay({ messageId }: { messageId: string }) {
  const { data: resources } = useLiveQuery(
    (q) =>
      q
        .from({ resourcesCollection })
        .where(({ resourcesCollection: r }) => eq(r.message_id, messageId)),
    [messageId]
  )

  if (!resources || resources.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {resources.map((r) => (
        <a
          key={r.id}
          href={r.file_location}
          download
          // The chip is too small for an inline date without crowding the name;
          // the upload time lives in the tooltip instead.
          title={`Download ${r.name} — uploaded ${formatDateTime(r.uploaded_at)}`}
          className="flex items-center gap-1.5 px-2 py-1 bg-card-surface border border-card-border rounded text-xs text-foreground hover:bg-icon-chip transition-colors"
        >
          <ResourceThumbnail
            fileLocation={r.file_location}
            mimeType={r.mime_type}
            size={28}
          />
          <span className="max-w-[150px] truncate">{r.name}</span>
          <Download className="w-3 h-3 text-muted-foreground shrink-0" />
        </a>
      ))}
    </div>
  )
}
