import { useState } from "react"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { Plus, Download, X, FileText, Image, Video, Music, File } from "lucide-react"
import { format } from "date-fns"
import { resourcesCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { deleteResourceAction } from "%/application/actions/resources"
import { usePendingResources } from "%/application/hooks/use-pending-resources"
import { AddResourceForm } from "./add-resource-form"
import { UploadSchedulePopover } from "./upload-schedule-popover"
import { formatDateTime } from "%/presentation/lib/datetime"

export interface ResourcesSectionProps {
  channelId: string | null
  taskId?: string | null
  buildunitId: string
  projectId: string
  createdbyId: string
  memberIds: string[]
}

function mimeIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <Image className="w-3.5 h-3.5 text-[#976623]" />
  if (mimeType.startsWith("video/")) return <Video className="w-3.5 h-3.5 text-[#976623]" />
  if (mimeType.startsWith("audio/")) return <Music className="w-3.5 h-3.5 text-[#976623]" />
  if (mimeType === "application/pdf" || mimeType.includes("word") || mimeType.includes("text"))
    return <FileText className="w-3.5 h-3.5 text-[#976623]" />
  return <File className="w-3.5 h-3.5 text-[#717182]" />
}

function formatBytes(bytes: number | bigint) {
  const n = Number(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function ResourcesSection({
  channelId,
  taskId,
  buildunitId,
  projectId,
  createdbyId,
  memberIds,
}: ResourcesSectionProps) {
  const [formOpen, setFormOpen] = useState(false)

  const { pendingResources, addPending, scheduleUpload, cancelPending, retryUpload } =
    usePendingResources(channelId, taskId)

  // Filter synced resources: by task_id when on a task page, otherwise by channel_id
  const { data: syncedResources } = useLiveQuery(
    (q) =>
      q
        .from({ resourcesCollection })
        .where(({ resourcesCollection: r }) =>
          taskId ? eq(r.task_id, taskId) : eq(r.channel_id, channelId ?? "")
        ),
    [channelId, taskId]
  )

  const handleFormSubmit = (file: File, meta: { name: string; description: string }) => {
    addPending(file, {
      name: meta.name,
      description: meta.description,
      channelId,
      taskId,
      buildunitId,
      projectId,
      createdbyId,
      memberIds,
    })
    setFormOpen(false)
  }

  const isEmpty =
    pendingResources.length === 0 && syncedResources.length === 0 && !formOpen

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-[#717182]">Resources</span>
        <button
          className="p-1 text-[#717182] hover:text-[#1e1e1e] transition-colors"
          onClick={() => setFormOpen((v) => !v)}
          title="Add resource"
        >
          <Plus className="w-3 h-3" />
        </button>
        {isEmpty && (
          <span className="text-sm text-[#717182]">Add document or link…</span>
        )}
      </div>

      {/* Inline add form */}
      {formOpen && (
        <AddResourceForm
          onSubmit={handleFormSubmit}
          onCancel={() => setFormOpen(false)}
        />
      )}

      {/* Pending resources (uploading client only) */}
      {pendingResources.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {pendingResources.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 px-3 py-2 bg-[#fdf8f2] border border-[#e5d4c1] rounded"
            >
              {mimeIcon(r.file.type)}

              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#1e1e1e] truncate">{r.name}</p>
                {r.status === "scheduled" && r.scheduledAt && (
                  <p className="text-[10px] text-[#976623]">
                    Scheduled: {format(r.scheduledAt, "MMM d, h:mm a")}
                  </p>
                )}
                {r.status === "error" && (
                  <p className="text-[10px] text-red-500">{r.errorMessage}</p>
                )}
                {r.status === "awaiting_network" && (
                  <p className="text-[10px] text-[#976623]">
                    Waiting for network — will upload when back online
                  </p>
                )}
                {r.status === "uploading" && (
                  <p className="text-[10px] text-[#717182]">Uploading…</p>
                )}
                {r.status === "awaiting_schedule" && (
                  <p className="text-[10px] text-[#717182]">
                    {formatBytes(r.file.size)} · waiting to upload
                  </p>
                )}
              </div>

              {/* Local download (from objectUrl) */}
              <a
                href={r.objectUrl}
                download={r.file.name}
                title="Download local copy"
                className="p-1 text-[#717182] hover:text-[#1e1e1e] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </a>

              {/* Upload schedule popover */}
              <UploadSchedulePopover
                resourceId={r.id}
                status={r.status}
                scheduledAt={r.scheduledAt}
                onSchedule={(id, scheduledAt) =>
                  r.status === "error"
                    ? retryUpload(id)
                    : scheduleUpload(id, scheduledAt)
                }
              />

              {/* Cancel/remove */}
              {r.status !== "uploading" && (
                <button
                  onClick={() => cancelPending(r.id)}
                  title="Remove"
                  className="p-1 text-[#717182] hover:text-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Synced resources (Electric — visible to all clients) */}
      {syncedResources.length > 0 && (
        <div className="space-y-1.5">
          {syncedResources.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 px-3 py-2 bg-[#fdf8f2] border border-[#e5d4c1] rounded hover:bg-[#f0e5d8] transition-colors"
            >
              {mimeIcon(r.mime_type)}

              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#1e1e1e] truncate">{r.name}</p>
                <p className="text-[10px] text-[#717182]">
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
                className="p-1 text-[#717182] hover:text-[#1e1e1e] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </a>

              {/* Delete */}
              <button
                onClick={() => deleteResourceAction({ id: r.id })}
                title="Delete resource"
                className="p-1 text-[#717182] hover:text-red-500 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
