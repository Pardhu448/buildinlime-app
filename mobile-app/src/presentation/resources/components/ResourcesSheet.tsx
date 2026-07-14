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
import { Paperclip, Plus, X, Download, RotateCw } from "lucide-react-native"
import { resourcesCollection } from "@/src/application/collections/communication"
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

function ResourceRow({ resource }: { resource: Resource }) {
  const { download, downloading } = useResourceDownload()

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
 * Two modes, one component (mirroring web, where TaskPage reuses
 * ResourcesSection with a taskId):
 *   - channel: standalone channel resources.
 *   - task:    resources attached to one task.
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
  // Task mode lists that task's attachments. Channel mode lists STANDALONE
  // resources only: message attachments render inside their bubble (see
  // MessageAttachments), and task attachments live on the task, so neither
  // belongs in the channel's sheet even though both carry its channel_id.
  //
  // Newest upload first. The live query returns the collection's keyed-map order,
  // which is not upload order and is not stable as rows sync in — so the sort has
  // to be explicit. Pending uploads are not sorted in: they have no timestamp
  // column, and they already render as a group above these, which is where the
  // most recent things belong.
  const resources = ((data ?? []) as Resource[])
    .filter((r) => (taskId ? r.task_id === taskId : !r.message_id && !r.task_id))
    .sort(
      (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
    )

  const { pendingUploads, enqueue, start, retry, cancel, schedule, rename } =
    usePendingUploads(taskId ? { taskId } : { channelId })

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
        <Paperclip size={16} color={colors.primary} strokeWidth={2} />
        {count > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{count > 99 ? "99+" : count}</Text>
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
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={handleAttach}
              activeOpacity={0.7}
            >
              <Plus size={14} color={colors.primaryForeground} strokeWidth={2.5} />
              <Text style={styles.attachText}>Attach</Text>
            </TouchableOpacity>
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
              <ResourceRow key={r.id} resource={r} />
            ))}
            {count === 0 && (
              <Text style={styles.empty}>
                No resources yet. Tap Attach to add one.
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
  trigger: {
    padding: 6,
  },
  countBadge: {
    position: "absolute",
    top: -2,
    right: -4,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontSize: 9,
    lineHeight: 12,
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
