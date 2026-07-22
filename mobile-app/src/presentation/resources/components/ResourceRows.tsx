import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native"
import { Download, RotateCw, X, Trash2 } from "lucide-react-native"
import { isRetryableStatus } from "@buildinlime/sync-core"
import { deleteResourceAction } from "@/src/application/actions/resources"
import { useResourceDownload } from "@/src/presentation/resources/hooks/useResourceDownload"
import { ResourceThumbnail } from "@/src/presentation/resources/components/ResourceThumbnail"
import { formatBytes } from "@/src/presentation/resources/lib/attachment-format"
import { formatDateTime } from "@/src/presentation/shared/lib/datetime"
import type { PendingUpload } from "@/src/infrastructure/offline/upload-manager"
import { colors } from "@/src/presentation/shared/colors"
import type { Resource } from "@buildinlime/domain-types"

// The two row shapes in the Resources sheet — a synced file and a not-yet-uploaded
// one. They share one StyleSheet because they are the same row with different
// trailing actions; keeping two copies of `row`/`info`/`name`/`meta` is how they
// would drift apart.

interface ResourceRowProps {
  resource: Resource
  canDelete: boolean
  /** Where the file came from — only set in channel mode, where the list mixes
   *  message attachments, task attachments and legacy standalone uploads. */
  source?: string
}

export function ResourceRow({ resource, canDelete, source }: ResourceRowProps) {
  const { download, downloading } = useResourceDownload()

  function confirmDelete() {
    Alert.alert("Delete file?", `"${resource.name}" is removed for everyone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteResourceAction({ id: resource.id }),
      },
    ])
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
  // Uploaded; kept briefly as the local stand-in until its synced row arrives.
  synced: "Sent",
}

interface PendingUploadRowProps {
  upload: PendingUpload
  onRetry: (id: string) => void
  onCancel: (id: string) => void
}

export function PendingUploadRow({ upload, onRetry, onCancel }: PendingUploadRowProps) {
  // Same two statuses the upload manager itself re-drives — see sync-core's
  // upload-policy, so the button and the retry logic cannot disagree.
  const retryable = isRetryableStatus(upload.status)

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

const styles = StyleSheet.create({
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
