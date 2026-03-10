import { useRef } from "react"
import { Paperclip, X, FileText, Image, Video, Music, File, Download } from "lucide-react"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { resourcesCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections"
export { parseTextArray } from "%/presentation/lib/utils"

export interface PendingAttachment {
  id: string
  file: File
  objectUrl: string
}

export function mimeIcon(mimeType: string, className = "w-3.5 h-3.5 text-[#976623]") {
  if (mimeType.startsWith("image/")) return <Image className={className} />
  if (mimeType.startsWith("video/")) return <Video className={className} />
  if (mimeType.startsWith("audio/")) return <Music className={className} />
  if (
    mimeType === "application/pdf" ||
    mimeType.includes("word") ||
    mimeType.includes("text")
  )
    return <FileText className={className} />
  return <File className="w-3.5 h-3.5 text-[#717182]" />
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
        className="p-1.5 hover:bg-[#f0e5d8] rounded transition-colors"
        title="Attach file"
      >
        <Paperclip className="w-4 h-4 text-[#717182]" />
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
          className="flex items-center gap-1.5 px-2 py-1 bg-white border border-[#e5d4c1] rounded text-xs text-[#1e1e1e]"
        >
          {mimeIcon(f.file.type)}
          <span className="max-w-[140px] truncate">{f.file.name}</span>
          <span className="text-[#717182] shrink-0">{formatBytes(f.file.size)}</span>
          <button
            type="button"
            onClick={() => {
              URL.revokeObjectURL(f.objectUrl)
              onRemove(f.id)
            }}
            className="text-[#717182] hover:text-red-500 transition-colors"
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
          title={`Download ${r.name}`}
          className="flex items-center gap-1.5 px-2 py-1 bg-[#fdf8f2] border border-[#e5d4c1] rounded text-xs text-[#1e1e1e] hover:bg-[#f0e5d8] transition-colors"
        >
          {mimeIcon(r.mime_type)}
          <span className="max-w-[150px] truncate">{r.name}</span>
          <Download className="w-3 h-3 text-[#717182] shrink-0" />
        </a>
      ))}
    </div>
  )
}
