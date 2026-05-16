import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native"
import { useState } from "react"
import { useLiveQuery, eq } from "@tanstack/react-db"
import * as DocumentPicker from "expo-document-picker"
import { resourcesCollection } from "@/src/application/collections/communication"
import { useSession } from "@/src/infrastructure/auth/client"
import { usePendingUploads } from "@/src/presentation/resources/hooks/usePendingUploads"
import { useResourceDownload } from "@/src/presentation/resources/hooks/useResourceDownload"
import { UploadScheduleModal } from "@/src/presentation/resources/components/UploadScheduleModal"
import { mimeEmoji, formatBytes } from "@/src/presentation/resources/lib/attachment-format"
import type { PendingUpload } from "@/src/infrastructure/offline/upload-manager"
import { colors } from "@/src/presentation/shared/colors"
import type { Resource } from "@buildinlime/domain-types"

function ResourceRow({ resource }: { resource: Resource }) {
  const { download, downloading } = useResourceDownload()

  return (
    <View style={styles.row}>
      <Text style={styles.emoji}>{mimeEmoji(resource.mime_type)}</Text>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{resource.name}</Text>
        <Text style={styles.meta}>
          {formatBytes(resource.file_size_bytes)}
          {resource.description ? ` · ${resource.description}` : ""}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.downloadBtn, downloading && styles.downloadBtnActive]}
        onPress={() => download(resource)}
        disabled={downloading}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.6}
      >
        <Text style={styles.downloadIcon}>{downloading ? "…" : "↓"}</Text>
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
      <Text style={styles.emoji}>{mimeEmoji(upload.mimeType)}</Text>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{upload.name}</Text>
        <Text
          style={[styles.meta, upload.status === "error" && styles.errorMeta]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      {retryable && (
        <TouchableOpacity
          style={styles.downloadBtn}
          onPress={() => onRetry(upload.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
        >
          <Text style={styles.downloadIcon}>↻</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.downloadBtn}
        onPress={() => onCancel(upload.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.6}
      >
        <Text style={styles.downloadIcon}>✕</Text>
      </TouchableOpacity>
    </View>
  )
}

interface ResourcesSectionProps {
  channelId: string
  buildUnitId: string
  projectId: string
}

export function ResourcesSection({
  channelId,
  buildUnitId,
  projectId,
}: ResourcesSectionProps) {
  const [expanded, setExpanded] = useState(true)
  const { data: session } = useSession()

  const { data } = useLiveQuery(
    (q) =>
      q
        .from({ resourcesCollection })
        .where(({ resourcesCollection: r }) => eq(r.channel_id, channelId)),
    [channelId]
  )
  // Standalone channel resources only — message attachments render inside
  // their message bubble (see MessageAttachments), not here.
  const resources = ((data ?? []) as Resource[]).filter((r) => !r.message_id)

  const { pendingUploads, enqueue, start, retry, cancel, schedule } =
    usePendingUploads({ channelId })

  // The just-picked file, parked in `awaiting_schedule` while the user decides
  // upload-now vs. schedule-for-later in the modal.
  const [scheduleTarget, setScheduleTarget] = useState<{
    id: string
    name: string
  } | null>(null)

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
        },
        { autoStart: false },
      )
      setScheduleTarget({ id, name: asset.name })
    } catch (err) {
      Alert.alert("Attach failed", String(err))
    }
  }

  // Always render: the attach button must be reachable even with no resources.
  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLabel}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.label}>Resources</Text>
          <Text style={styles.chevron}>{expanded ? "⌄" : "›"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleAttach}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
        >
          <Text style={styles.attach}>+ Attach</Text>
        </TouchableOpacity>
      </View>
      {expanded && (
        <View style={styles.list}>
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
          {resources.length === 0 && pendingUploads.length === 0 && (
            <Text style={styles.empty}>No resources yet.</Text>
          )}
        </View>
      )}
      {scheduleTarget && (
        <UploadScheduleModal
          visible
          fileName={scheduleTarget.name}
          onUploadNow={() => {
            start(scheduleTarget.id)
            setScheduleTarget(null)
          }}
          onSchedule={(when) => {
            void schedule(scheduleTarget.id, when)
            setScheduleTarget(null)
          }}
          onCancel={() => {
            void cancel(scheduleTarget.id)
            setScheduleTarget(null)
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  headerLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chevron: {
    fontSize: 16,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  attach: {
    fontSize: 12,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.primary,
  },
  list: {
    gap: 6,
  },
  empty: {
    fontSize: 12,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.muted,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pendingRow: {
    opacity: 0.85,
  },
  emoji: {
    fontSize: 16,
  },
  info: {
    flex: 1,
    gap: 1,
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
  downloadBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  downloadBtnActive: {
    opacity: 0.5,
  },
  downloadIcon: {
    fontSize: 14,
    color: colors.mutedForeground,
    fontFamily: "InstrumentSans_600SemiBold",
  },
})
