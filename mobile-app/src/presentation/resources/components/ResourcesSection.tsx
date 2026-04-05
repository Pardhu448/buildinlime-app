import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native"
import { useState } from "react"
import { useLiveQuery, eq } from "@tanstack/react-db"
import * as FileSystem from "expo-file-system/legacy"
import * as Sharing from "expo-sharing"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import { createCookieFetch } from "@/src/infrastructure/auth/cookie-fetch"
import { colors } from "@/src/presentation/shared/colors"
import type { Resource } from "@buildinlime/domain-types"

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"

function formatBytes(bytes: number | bigint): string {
  const n = Number(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function mimeEmoji(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️"
  if (mimeType.startsWith("video/")) return "🎬"
  if (mimeType.startsWith("audio/")) return "🎵"
  if (mimeType === "application/pdf") return "📄"
  if (mimeType.includes("word") || mimeType.includes("text")) return "📝"
  return "📎"
}

function ResourceRow({ resource }: { resource: Resource }) {
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (downloading) return
    setDownloading(true)
    try {
      const url = `${API_URL}${resource.file_location}`
      const localUri = `${FileSystem.cacheDirectory}${resource.name}`

      // Use the same cookieFetch that tRPC uses — it sends the Origin header
      // and any stored session cookies, matching how all other auth requests work.
      const cookieFetch = createCookieFetch()
      const response = await cookieFetch(url)
      if (!response.ok) {
        Alert.alert("Download failed", `Server returned ${response.status}`)
        return
      }

      const blob = await response.blob()
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result as string
          resolve(result.split(",")[1]) // strip the data URL prefix
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      await FileSystem.writeAsStringAsync(localUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      })

      Alert.alert("Downloaded", `"${resource.name}" saved to device.`, [
        { text: "Dismiss", style: "cancel" },
        {
          text: "Open With…",
          onPress: async () => {
            const canShare = await Sharing.isAvailableAsync()
            if (canShare) {
              // shareAsync wraps Intent.createChooser on Android, always showing
              // the full chooser sheet (open with + share options)
              await Sharing.shareAsync(localUri, { mimeType: resource.mime_type })
            }
          },
        },
      ])
    } catch (err) {
      Alert.alert("Download failed", String(err))
    } finally {
      setDownloading(false)
    }
  }

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
        onPress={handleDownload}
        disabled={downloading}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.6}
      >
        <Text style={styles.downloadIcon}>{downloading ? "…" : "↓"}</Text>
      </TouchableOpacity>
    </View>
  )
}

interface ResourcesSectionProps {
  channelId: string
}

export function ResourcesSection({ channelId }: ResourcesSectionProps) {
  const { collections } = useProjectContext()
  const [expanded, setExpanded] = useState(true)

  const { data } = useLiveQuery(
    (q) =>
      q
        .from({ resourcesCollection: collections!.resourcesCollection })
        .where(({ resourcesCollection: r }) => eq(r.channel_id, channelId)),
    [collections, channelId]
  )
  const resources = (data ?? []) as Resource[]

  if (resources.length === 0) return null

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={styles.label}>Resources</Text>
        <Text style={styles.chevron}>{expanded ? "⌄" : "›"}</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.list}>
          {resources.map((r) => (
            <ResourceRow key={r.id} resource={r} />
          ))}
        </View>
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
  list: {
    gap: 6,
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
