import { useState } from "react"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { Plus, Download, X } from "lucide-react"
import { format } from "date-fns"
import { resourcesCollection, tasksCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { deleteResourceAction } from "%/application/actions/resources"
import { usePendingResources } from "%/application/hooks/use-pending-resources"
import { AddResourceForm } from "./add-resource-form"
import { ResourceThumbnail } from "./ResourceThumbnail"
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
  const { data: syncedResourceRows } = useLiveQuery(
    (q) =>
      q
        .from({ resourcesCollection })
        .where(({ resourcesCollection: r }) =>
          taskId ? eq(r.task_id, taskId) : eq(r.channel_id, channelId ?? "")
        ),
    [channelId, taskId]
  )

  // Who owns this task, if we're on a task page. A file may be deleted by its
  // uploader OR by the task's creator — tasks.delete already soft-deletes every
  // attachment on a task whoever uploaded it, so uploader-only would have let you
  // destroy a file by deleting the whole task while forbidding you to remove it
  // singly (see routers/resources.ts).
  const { data: taskRows } = useLiveQuery(
    (q) =>
      q
        .from({ tasksCollection })
        .where(({ tasksCollection: t }) => eq(t.id, taskId ?? "")),
    [taskId]
  )
  // The `| undefined` in these casts is deliberate: useLiveQuery types its data as a
  // plain array, but it really is undefined on the first render before the query has
  // resolved — so the ?? [] is load-bearing, not defensive noise.
  const isTaskCreator =
    !!taskId &&
    ((taskRows as { createdby_id?: string }[] | undefined) ?? [])[0]?.createdby_id ===
      createdbyId

  const canDelete = (uploaderId: string) => uploaderId === createdbyId || isTaskCreator

  // Newest upload first. The live query returns the collection's keyed-map order,
  // which is not upload order and is not stable as rows sync in — so the sort has
  // to be explicit. Same fix as the mobile ResourcesSheet.
  const syncedResources = ((syncedResourceRows as typeof syncedResourceRows | undefined) ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.uploaded_at as string).getTime() -
        new Date(a.uploaded_at as string).getTime()
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
              className="flex items-center gap-2 px-3 py-2 bg-card-surface border border-card-border rounded"
            >
              {/* Previews from the local blob while it is still uploading — the bytes
                  are already here, so it costs no request. */}
              <ResourceThumbnail
                localUrl={r.objectUrl}
                mimeType={r.file.type}
                size={36}
              />

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
              className="flex items-center gap-2 px-3 py-2 bg-card-surface border border-card-border rounded hover:bg-icon-chip transition-colors"
            >
              <ResourceThumbnail
                fileLocation={r.file_location}
                mimeType={r.mime_type}
                size={36}
              />

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

              {/* Delete — uploader, or the creator of the task this file hangs off.
                  The server enforces it (FORBIDDEN otherwise); hiding the button is
                  courtesy, not the control. It used to render unconditionally, so
                  deleting someone else's file optimistically removed the row and then
                  snapped it back when the server refused, with nothing shown. */}
              {canDelete(r.createdby_id as string) && (
                <button
                  onClick={() => deleteResourceAction({ id: r.id })}
                  title="Delete resource"
                  className="p-1 text-[#717182] hover:text-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
