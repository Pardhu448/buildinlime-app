import { Download, X } from "lucide-react"
import { format } from "date-fns"
import type { PendingResource } from "%/application/hooks/use-pending-resources"
import { ResourceThumbnail } from "./ResourceThumbnail"
import { UploadSchedulePopover } from "./upload-schedule-popover"
import { formatBytes } from "%/presentation/lib/format-bytes"

export interface PendingResourceRowProps {
  resource: PendingResource
  scheduleUpload: (id: string, scheduledAt: Date | null) => void
  retryUpload: (id: string) => void
  cancelPending: (id: string) => void
}

/** A resource still uploading — visible only to the uploading client. Previews
 *  from the local blob (the bytes are already here) and offers a local download,
 *  reschedule, and cancel. */
export function PendingResourceRow({
  resource: r,
  scheduleUpload,
  retryUpload,
  cancelPending,
}: PendingResourceRowProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-card-surface border border-card-border rounded">
      {/* Previews from the local blob while it is still uploading — the bytes
          are already here, so it costs no request. */}
      <ResourceThumbnail localUrl={r.objectUrl} mimeType={r.file.type} size={36} />

      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate">{r.name}</p>
        {r.status === "scheduled" && r.scheduledAt && (
          <p className="text-[10px] text-primary">
            Scheduled: {format(r.scheduledAt, "MMM d, h:mm a")}
          </p>
        )}
        {r.status === "error" && (
          <p className="text-[10px] text-red-500">{r.errorMessage}</p>
        )}
        {r.status === "awaiting_network" && (
          <p className="text-[10px] text-primary">
            Waiting for network — will upload when back online
          </p>
        )}
        {r.status === "uploading" && (
          <p className="text-[10px] text-muted-foreground">Uploading…</p>
        )}
        {r.status === "awaiting_schedule" && (
          <p className="text-[10px] text-muted-foreground">
            {formatBytes(r.file.size)} · waiting to upload
          </p>
        )}
      </div>

      {/* Local download (from objectUrl) */}
      <a
        href={r.objectUrl}
        download={r.file.name}
        title="Download local copy"
        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
      </a>

      {/* Upload schedule popover */}
      <UploadSchedulePopover
        resourceId={r.id}
        status={r.status}
        scheduledAt={r.scheduledAt}
        onSchedule={(id, scheduledAt) =>
          r.status === "error" ? retryUpload(id) : scheduleUpload(id, scheduledAt)
        }
      />

      {/* Cancel/remove */}
      {r.status !== "uploading" && (
        <button
          onClick={() => cancelPending(r.id)}
          title="Remove"
          className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
