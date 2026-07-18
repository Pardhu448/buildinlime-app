import { useState } from "react"
import { Alert } from "react-native"
import { useLiveQuery, eq } from "@tanstack/react-db"
import * as DocumentPicker from "expo-document-picker"
import { Paperclip } from "lucide-react-native"
import { resourcesCollection, tasksCollection } from "@/src/application/collections/communication"
import { useSession } from "@/src/infrastructure/auth/client"
import { usePendingUploads } from "@/src/presentation/resources/hooks/usePendingUploads"
import { UploadScheduleModal } from "@/src/presentation/resources/components/UploadScheduleModal"
import {
  ResourceRow,
  PendingUploadRow,
} from "@/src/presentation/resources/components/ResourceRows"
import {
  BottomSheet,
  SheetTrigger,
  SheetActionButton,
  SheetScroll,
  SheetEmpty,
} from "@/src/presentation/shared/components/BottomSheet"
import type { Resource } from "@buildinlime/domain-types"

interface ResourcesSheetProps {
  channelId: string
  buildUnitId: string
  projectId: string
  /** Attach to a task instead of the channel — the task detail screen passes this. */
  taskId?: string
}

/**
 * Resources as a header button that opens a half-screen scrollable sheet,
 * rather than an always-present section competing with the message list.
 *
 * Two modes, one component, mirroring web:
 *   - channel: an INDEX of every file in the channel, however it got there —
 *              message attachments, task attachments, legacy standalone uploads.
 *              Read-and-delete only; there is no upload here, because a file
 *              enters a channel by being attached to a message or a task.
 *              (Web's equivalent is ResourceDisplay on ChannelPage.)
 *   - task:    the files attached to one task, with upload. (Web: ResourcesSection.)
 */
export function ResourcesSheet({
  channelId,
  buildUnitId,
  projectId,
  taskId,
}: ResourcesSheetProps) {
  const [open, setOpen] = useState(false)
  const { data: session } = useSession()

  const { data } = useLiveQuery(
    (q) =>
      q
        .from({ resourcesCollection })
        .where(({ resourcesCollection: r }) => eq(r.channel_id, channelId)),
    [channelId]
  )
  // Task mode lists that task's attachments. Channel mode is an INDEX: every file
  // in the channel, whatever it hangs off — message attachments, task attachments,
  // and the legacy standalone uploads. This mirrors web's channel ResourceDisplay.
  //
  // It used to list standalone resources ONLY, on the reasoning that message
  // attachments render in their bubble and task attachments live on the task. But
  // that left the channel with no place to answer "where is that file someone sent
  // last week" — you had to scroll the thread to find it. The two views serve
  // different questions, and the index is the one this sheet is for.
  //
  // Newest upload first. The live query returns the collection's keyed-map order,
  // which is not upload order and is not stable as rows sync in — so the sort has
  // to be explicit. Pending uploads are not sorted in: they have no timestamp
  // column, and they already render as a group above these, which is where the
  // most recent things belong.
  const resources = ((data ?? []) as Resource[])
    .filter((r) => (taskId ? r.task_id === taskId : true))
    .sort(
      (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
    )

  const { pendingUploads, enqueue, start, retry, cancel, schedule, rename } =
    usePendingUploads(taskId ? { taskId } : { channelId })

  // Every task in this channel, keyed by id. Channel mode needs this per ROW, not
  // per sheet: the list now mixes files from different tasks, so each row has to
  // resolve its own task to know who may delete it and where it came from.
  const { data: channelTasks } = useLiveQuery(
    (q) =>
      q
        .from({ tasksCollection })
        .where(({ tasksCollection: t }) => eq(t.channel_id, channelId)),
    [channelId]
  )
  const taskById = new Map(
    ((channelTasks ?? []) as { id: string; name?: string; createdby_id?: string }[])
      .map((t) => [t.id, t]),
  )

  const userId = session?.user?.id

  // A file may be deleted by its uploader OR by the creator of the task it hangs
  // off — tasks.delete already soft-deletes every attachment on a task whoever
  // uploaded it, so uploader-only would have let you destroy a file by deleting
  // the whole task while forbidding you to remove it singly. The server enforces
  // this (FORBIDDEN otherwise); gating the button is courtesy, not the control.
  const canDelete = (r: Resource) =>
    r.createdby_id === userId ||
    (!!r.task_id && taskById.get(r.task_id)?.createdby_id === userId)

  // In the channel index a file's origin is not obvious from the row alone.
  // Task mode needs no label — everything there belongs to the one task.
  const sourceLabel = (r: Resource): string | undefined => {
    if (taskId) return undefined
    if (r.task_id) return `In task · ${taskById.get(r.task_id)?.name ?? `task`}`
    if (r.message_id) return `In a message`
    return undefined
  }

  // The just-picked file, parked in `awaiting_schedule` while the user decides
  // upload-now vs. schedule-for-later in the modal.
  const [scheduleTarget, setScheduleTarget] = useState<{
    id: string
    name: string
  } | null>(null)

  const count = resources.length + pendingUploads.length

  async function handleAttach() {
    const userId = session?.user?.id
    if (!userId) {
      Alert.alert("Cannot attach", "Your session is still loading — try again.")
      return
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      })
      if (result.canceled) return
      const asset = result.assets[0]
      if (!asset) return
      // autoStart: false — hold in `awaiting_schedule` until the modal resolves.
      const id = await enqueue(
        asset.uri,
        {
          name: asset.name,
          mimeType: asset.mimeType ?? "application/octet-stream",
          channelId,
          buildUnitId,
          projectId,
          createdById: userId,
          // Sent as `taskId` in the upload form; the server sets resources.task_id.
          // Without it the file would land as a plain channel resource.
          taskId: taskId ?? null,
        },
        { autoStart: false },
      )
      setScheduleTarget({ id, name: asset.name })
    } catch (err) {
      Alert.alert("Attach failed", String(err))
    }
  }

  return (
    <>
      <SheetTrigger icon={Paperclip} count={count} onPress={() => setOpen(true)} />

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Resources"
        // Task mode only. A file enters a channel by being attached to a message
        // or a task — the channel sheet is an index of those, not a third place to
        // upload into (matching web, which has no channel-level upload either).
        // The standalone rows already in the data still list.
        headerAction={
          taskId ? <SheetActionButton label="Attach" onPress={handleAttach} /> : undefined
        }
      >
        <SheetScroll>
          {pendingUploads.map((u) => (
            <PendingUploadRow key={u.id} upload={u} onRetry={retry} onCancel={cancel} />
          ))}
          {resources.map((r) => (
            <ResourceRow
              key={r.id}
              resource={r}
              canDelete={canDelete(r)}
              source={sourceLabel(r)}
            />
          ))}
          {count === 0 && (
            <SheetEmpty>
              {taskId
                ? `No resources yet. Tap Attach to add one.`
                : `No files in this channel yet. Attach one to a message or a task.`}
            </SheetEmpty>
          )}
        </SheetScroll>
      </BottomSheet>

      {scheduleTarget && (
        <UploadScheduleModal
          visible
          fileName={scheduleTarget.name}
          // Rename must land before the bytes go out — renameUpload is a no-op
          // once the status flips to `uploading`.
          onUploadNow={async (name) => {
            const { id } = scheduleTarget
            setScheduleTarget(null)
            await rename(id, name)
            start(id)
          }}
          onSchedule={async (when, name) => {
            const { id } = scheduleTarget
            setScheduleTarget(null)
            await rename(id, name)
            void schedule(id, when)
          }}
          onCancel={() => {
            void cancel(scheduleTarget.id)
            setScheduleTarget(null)
          }}
        />
      )}
    </>
  )
}
