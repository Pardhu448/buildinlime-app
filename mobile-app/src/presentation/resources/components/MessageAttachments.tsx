import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { ResourceThumbnail } from "@/src/presentation/resources/components/ResourceThumbnail"
import { InlineImage } from "@/src/presentation/resources/components/InlineImage"
import { InlineVideo } from "@/src/presentation/resources/components/InlineVideo"
import { AudioPlayer } from "@/src/presentation/resources/components/AudioPlayer"
import { useResourceDownload } from "@/src/presentation/resources/hooks/useResourceDownload"
import { mediaKind } from "@/src/presentation/resources/lib/attachment-format"
import { resourceUrl } from "@/src/presentation/resources/lib/media-source"
import type { PendingUpload } from "@/src/infrastructure/offline/upload-manager"
import { colors } from "@/src/presentation/shared/colors"
import type { Resource } from "@buildinlime/domain-types"

// Attachments rendered INSIDE a message bubble. Picture / audio / video render
// inline (the media IS the message); every other type (pdf, docs) stays a
// tappable download chip. `isOwn` flips the palette so chips and the audio
// control stay readable on both the dark own-bubble and the light other-bubble.

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
    case "synced":
      return "Sent"
    default:
      return "Queued"
  }
}

// ── Inline media, driven off mime type ──────────────────────────────────────
// `remoteUrl` for a synced resource, `localUri` for a still-uploading file.

function InlineMedia({
  kind,
  remoteUrl,
  localUri,
  mimeType,
  isOwn,
}: {
  kind: "image" | "video" | "audio"
  remoteUrl?: string
  localUri?: string
  mimeType?: string
  isOwn: boolean
}) {
  if (kind === "image") return <InlineImage remoteUrl={remoteUrl} localUri={localUri} mimeType={mimeType} />
  // Video posters are keyed by resource id alone, so the video path needs no mime.
  if (kind === "video") return <InlineVideo remoteUrl={remoteUrl} localUri={localUri} />
  return <AudioPlayer remoteUrl={remoteUrl} localUri={localUri} mimeType={mimeType} isOwn={isOwn} />
}

// ── Non-media: the existing download / status chips ─────────────────────────

function SyncedAttachment({ resource, isOwn }: { resource: Resource; isOwn: boolean }) {
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
      <Text style={[styles.name, isOwn ? styles.textOwn : styles.textOther]} numberOfLines={1}>
        {resource.name}
      </Text>
      <Text style={[styles.trailing, isOwn ? styles.textOwn : styles.textOther]}>
        {downloading ? "…" : "↓"}
      </Text>
    </TouchableOpacity>
  )
}

function PendingChip({ upload, isOwn }: { upload: PendingUpload; isOwn: boolean }) {
  return (
    <View style={[styles.chip, isOwn ? styles.chipOwn : styles.chipOther]}>
      <ResourceThumbnail localUri={upload.uri} mimeType={upload.mimeType} size={32} />
      <Text style={[styles.name, isOwn ? styles.textOwn : styles.textOther]} numberOfLines={1}>
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

// A media upload in flight: the media renders inline from its local uri, with a
// small status caption underneath until the synced resource replaces it. Once
// `synced`, the caption is dropped so the local stand-in looks exactly like the
// final message while it waits for its resource row to arrive — a seamless swap.
function PendingMedia({ upload, isOwn }: { upload: PendingUpload; isOwn: boolean }) {
  const kind = mediaKind(upload.mimeType)!
  return (
    <View style={styles.pendingMedia}>
      <InlineMedia kind={kind} localUri={upload.uri} mimeType={upload.mimeType} isOwn={isOwn} />
      {upload.status !== "synced" && (
        <Text
          style={[
            styles.pendingCaption,
            isOwn ? styles.textOwn : styles.textMuted,
            upload.status === "error" && styles.errorTrailing,
          ]}
        >
          {pendingLabel(upload.status)}
        </Text>
      )}
    </View>
  )
}

export function MessageAttachments({ resources, pendingUploads, isOwn }: MessageAttachmentsProps) {
  // A synced resource and its optimistic upload share an id. The manager keeps a
  // `synced` upload alive to bridge the Electric replay gap, so both can be
  // present for a frame or two — render only the pending one until its resource
  // has arrived, then let the synced (remote) render take over. No gap, no double.
  const syncedIds = new Set(resources.map((r) => r.id))
  const livePending = pendingUploads.filter((u) => !syncedIds.has(u.id))

  if (resources.length === 0 && livePending.length === 0) return null
  return (
    <View style={styles.list}>
      {livePending.map((u) =>
        mediaKind(u.mimeType) ? (
          <PendingMedia key={u.id} upload={u} isOwn={isOwn} />
        ) : (
          <PendingChip key={u.id} upload={u} isOwn={isOwn} />
        ),
      )}
      {resources.map((r) => {
        const kind = mediaKind(r.mime_type)
        return kind ? (
          <InlineMedia key={r.id} kind={kind} remoteUrl={resourceUrl(r.file_location)} mimeType={r.mime_type} isOwn={isOwn} />
        ) : (
          <SyncedAttachment key={r.id} resource={r} isOwn={isOwn} />
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  list: {
    gap: 6,
    marginTop: 6,
  },
  pendingMedia: {
    gap: 3,
  },
  pendingCaption: {
    fontSize: 11,
    fontFamily: "InstrumentSans_600SemiBold",
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
  textMuted: {
    color: colors.mutedForeground,
  },
  errorTrailing: {
    color: colors.destructive,
  },
})
