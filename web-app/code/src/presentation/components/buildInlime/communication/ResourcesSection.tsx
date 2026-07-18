import { useState } from "react"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { Plus } from "lucide-react"
import { resourcesCollection, tasksCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { deleteResourceAction } from "%/application/actions/resources"
import { usePendingResources } from "%/application/hooks/use-pending-resources"
import { AddResourceForm } from "./add-resource-form"
import { PendingResourceRow } from "./PendingResourceRow"
import { SyncedResourceRow } from "./SyncedResourceRow"

export interface ResourcesSectionProps {
  channelId: string | null
  taskId?: string | null
  buildunitId: string
  projectId: string
  createdbyId: string
}

export function ResourcesSection({
  channelId,
  taskId,
  buildunitId,
  projectId,
  createdbyId,
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
    })
    setFormOpen(false)
  }

  const isEmpty =
    pendingResources.length === 0 && syncedResources.length === 0 && !formOpen

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-muted-foreground">Resources</span>
        <button
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setFormOpen((v) => !v)}
          title="Add resource"
        >
          <Plus className="w-3 h-3" />
        </button>
        {isEmpty && (
          <span className="text-sm text-muted-foreground">Add document or link…</span>
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
            <PendingResourceRow
              key={r.id}
              resource={r}
              scheduleUpload={scheduleUpload}
              retryUpload={retryUpload}
              cancelPending={cancelPending}
            />
          ))}
        </div>
      )}

      {/* Synced resources (Electric — visible to all clients) */}
      {syncedResources.length > 0 && (
        <div className="space-y-1.5">
          {syncedResources.map((r) => (
            <SyncedResourceRow
              key={r.id}
              resource={r}
              canDelete={canDelete(r.createdby_id as string)}
              onDelete={(id) => deleteResourceAction({ id })}
            />
          ))}
        </div>
      )}
    </div>
  )
}
