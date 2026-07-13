import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { ResourceThumbnail } from "@/src/presentation/resources/components/ResourceThumbnail"
import { useResourceDownload } from "@/src/presentation/resources/hooks/useResourceDownload"
import type { PendingUpload } from "@/src/infrastructure/offline/upload-manager"
import { colors } from "@/src/presentation/shared/colors"
import type { Resource } from "@buildinlime/domain-types"

// Attachments rendered INSIDE a message bubble: synced resources (tappable to
// download) and still-uploading attachments (status only). `isOwn` flips the
// palette so chips stay readable on both the dark own-bubble and the light
// other-bubble.

interface MessageAttachmentsProps {
  resources: Resource[]
  pendingUploads: PendingUpload[]
  isOwn: boolean
}

function pendingLabel(status: PendingUpload["status"]): string {
  switch (status) {
    case "uploading":
      return "Uploading…"
    case "awaiting_network":
      return "Waiting for network"
    case "error":
      return "Upload failed"
    case "scheduled":
      return "Scheduled"
    default:
      return "Queued"
  }
}

function SyncedAttachment({
  resource,
  isOwn,
}: {
  resource: Resource
  isOwn: boolean
}) {
  const { download, downloading } = useResourceDownload()
  return (
    <TouchableOpacity
      style={[styles.chip, isOwn ? styles.chipOwn : styles.chipOther]}
      onPress={() => download(resource)}
      disabled={downloading}
      activeOpacity={0.6}
    >
      <ResourceThumbnail
        fileLocation={resource.file_location}
        mimeType={resource.mime_type}
        size={32}
      />
      <Text
        style={[styles.name, isOwn ? styles.textOwn : styles.textOther]}
        numberOfLines={1}
      >
        {resource.name}
      </Text>
      <Text style={[styles.trailing, isOwn ? styles.textOwn : styles.textOther]}>
        {downloading ? "…" : "↓"}
      </Text>
    </TouchableOpacity>
  )
}

function PendingAttachment({
  upload,
  isOwn,
}: {
  upload: PendingUpload
  isOwn: boolean
}) {
  return (
    <View style={[styles.chip, isOwn ? styles.chipOwn : styles.chipOther]}>
      <ResourceThumbnail localUri={upload.uri} mimeType={upload.mimeType} size={32} />
      <Text
        style={[styles.name, isOwn ? styles.textOwn : styles.textOther]}
        numberOfLines={1}
      >
        {upload.name}
      </Text>
      <Text
        style={[
          styles.trailing,
          isOwn ? styles.textOwn : styles.textOther,
          upload.status === "error" && styles.errorTrailing,
        ]}
      >
        {pendingLabel(upload.status)}
      </Text>
    </View>
  )
}

export function MessageAttachments({
  resources,
  pendingUploads,
  isOwn,
}: MessageAttachmentsProps) {
  if (resources.length === 0 && pendingUploads.length === 0) return null
  return (
    <View style={styles.list}>
      {pendingUploads.map((u) => (
        <PendingAttachment key={u.id} upload={u} isOwn={isOwn} />
      ))}
      {resources.map((r) => (
        <SyncedAttachment key={r.id} resource={r} isOwn={isOwn} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list: {
    gap: 4,
    marginTop: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  chipOwn: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  chipOther: {
    backgroundColor: colors.background,
  },
  name: {
    flex: 1,
    fontSize: 12,
    fontFamily: "InstrumentSans_500Medium",
  },
  trailing: {
    fontSize: 11,
    fontFamily: "InstrumentSans_600SemiBold",
  },
  textOwn: {
    color: colors.primaryForeground,
  },
  textOther: {
    color: colors.foreground,
  },
  errorTrailing: {
    color: colors.destructive,
  },
})
