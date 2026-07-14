import { useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLiveQuery, eq } from "@tanstack/react-db"
import * as DocumentPicker from "expo-document-picker"
import { Paperclip, Plus, X, Download, RotateCw, Trash2 } from "lucide-react-native"
import { resourcesCollection, tasksCollection } from "@/src/application/collections/communication"
import { deleteResourceAction } from "@/src/application/actions/resources"
import { useSession } from "@/src/infrastructure/auth/client"
import { usePendingUploads } from "@/src/presentation/resources/hooks/usePendingUploads"
import { useResourceDownload } from "@/src/presentation/resources/hooks/useResourceDownload"
import { UploadScheduleModal } from "@/src/presentation/resources/components/UploadScheduleModal"
import { ResourceThumbnail } from "@/src/presentation/resources/components/ResourceThumbnail"
import { formatBytes } from "@/src/presentation/resources/lib/attachment-format"
import { formatDateTime } from "@/src/presentation/shared/lib/datetime"
import type { PendingUpload } from "@/src/infrastructure/offline/upload-manager"
import { colors } from "@/src/presentation/shared/colors"
import type { Resource } from "@buildinlime/domain-types"

function ResourceRow({
  resource,
  canDelete,
  source,
}: {
  resource: Resource
  canDelete: boolean
  /** Where the file came from — only set in channel mode, where the list mixes
   *  message attachments, task attachments and legacy standalone uploads. */
  source?: string
}) {
  const { download, downloading } = useResourceDownload()

  function confirmDelete() {
    Alert.alert(
      "Delete file?",
      `"${resource.name}" is removed for everyone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteResourceAction({ id: resource.id }),
        },
      ]
    )
  }

  return (
    <View style={styles.row}>
      <ResourceThumbnail
        fileLocation={resource.file_location}
        mimeType={resource.mime_type}
      />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {resource.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {formatDateTime(resource.uploaded_at)}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {formatBytes(resource.file_size_bytes)}
          {resource.description ? ` · ${resource.description}` : ""}
        </Text>
        {source ? (
          <Text style={styles.source} numberOfLines={1}>
            {source}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={[styles.actionBtn, downloading && styles.actionBtnActive]}
        onPress={() => download(resource)}
        disabled={downloading}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.6}
      >
        <Download size={14} color={colors.mutedForeground} strokeWidth={2} />
      </TouchableOpacity>
      {/* Uploader only. The server enforces it (FORBIDDEN otherwise) — hiding the
          button is courtesy, not the control. */}
      {canDelete && (
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={confirmDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
        >
          <Trash2 size={14} color={colors.mutedForeground} strokeWidth={2} />
        </TouchableOpacity>
      )}
    </View>
  )
}

const STATUS_LABEL: Record<PendingUpload["status"], string> = {
  awaiting_schedule: "Queued",
  scheduled: "Scheduled",
  uploading: "Uploading…",
  awaiting_network: "Waiting for network",
  error: "Upload failed",
}

function PendingUploadRow({
  upload,
  onRetry,
  onCancel,
}: {
  upload: PendingUpload
  onRetry: (id: string) => void
  onCancel: (id: string) => void
}) {
  const retryable = upload.status === "error" || upload.status === "awaiting_network"
  let label: string
  if (upload.status === "error" && upload.errorMessage) {
    label = upload.errorMessage
  } else if (upload.status === "scheduled" && upload.scheduledAt) {
    label = `Scheduled · ${upload.scheduledAt.toLocaleString()}`
  } else {
    label = STATUS_LABEL[upload.status]
  }

  return (
    <View style={[styles.row, styles.pendingRow]}>
      {/* Not uploaded yet — preview straight off the device. */}
      <ResourceThumbnail localUri={upload.uri} mimeType={upload.mimeType} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {upload.name}
        </Text>
        <Text
          style={[styles.meta, upload.status === "error" && styles.errorMeta]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      {retryable && (
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onRetry(upload.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
        >
          <RotateCw size={14} color={colors.mutedForeground} strokeWidth={2} />
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => onCancel(upload.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.6}
      >
        <X size={14} color={colors.mutedForeground} strokeWidth={2} />
      </TouchableOpacity>
    </View>
  )
}

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
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
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
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
      >
        {/* 20px to match the TasksSheet's ListTodo sitting next to it. */}
        <Paperclip size={20} color={colors.primary} strokeWidth={2} />
        {count > 0 ? (
          <View style={styles.countBadge}>
            {/* numberOfLines={1}: a constrained badge would otherwise WRAP "18" and
                show only the "1", the 15px height hiding the rest. */}
            <Text style={styles.countText} numberOfLines={1}>
              {count > 99 ? "99+" : count}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        {/* Backdrop closes the sheet */}
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

        <View
          style={[
            styles.sheet,
            { height: height * 0.5, paddingBottom: insets.bottom },
          ]}
        >
          <View style={styles.grabber} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Resources</Text>
            {/* Task mode only. A file enters a channel by being attached to a
                message or a task — the channel sheet is an index of those, not a
                third place to upload into (matching web, which has no channel-level
                upload either). The standalone rows already in the data still list. */}
            {taskId && (
              <TouchableOpacity
                style={styles.attachBtn}
                onPress={handleAttach}
                activeOpacity={0.7}
              >
                <Plus size={14} color={colors.primaryForeground} strokeWidth={2.5} />
                <Text style={styles.attachText}>Attach</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setOpen(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.6}
            >
              <X size={18} color={colors.mutedForeground} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
          >
            {pendingUploads.map((u) => (
              <PendingUploadRow
                key={u.id}
                upload={u}
                onRetry={retry}
                onCancel={cancel}
              />
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
              <Text style={styles.empty}>
                {taskId
                  ? `No resources yet. Tap Attach to add one.`
                  : `No files in this channel yet. Attach one to a message or a task.`}
              </Text>
            )}
          </ScrollView>
        </View>
      </Modal>

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

const styles = StyleSheet.create({
  // The badge sits INSIDE the trigger's box. It used to be pinned outside it
  // (top: -2, right: -4); Android clips a child that overflows its parent, so once
  // the count went two-digit the badge grew wider, ran past the edge and lost its
  // right half — "18" rendered as "1". Single-digit counts fit, which is why it
  // only surfaced when the sheet started counting the whole channel instead of
  // standalone uploads alone. The padding here is what reserves that room, so the
  // badge has somewhere to grow (up to "99+") without leaving the bounds.
  trigger: {
    paddingTop: 9,
    paddingRight: 12,
    paddingBottom: 6,
    paddingLeft: 6,
  },
  countBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontSize: 10,
    lineHeight: 13,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.primaryForeground,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cardBorder,
    marginTop: 8,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  sheetTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
  },
  attachBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  attachText: {
    fontSize: 12,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.primaryForeground,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 10,
    gap: 8,
  },
  empty: {
    fontSize: 13,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
    textAlign: "center",
    paddingVertical: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.cardSurface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pendingRow: {
    opacity: 0.85,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 13,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.foreground,
  },
  meta: {
    fontSize: 11,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
  },
  source: {
    fontSize: 11,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.primary,
  },
  errorMeta: {
    color: colors.destructive,
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  actionBtnActive: {
    opacity: 0.5,
  },
})
