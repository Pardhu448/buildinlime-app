import { useState } from "react"
import { Alert, Platform } from "react-native"
import * as FileSystem from "expo-file-system/legacy"
import * as Sharing from "expo-sharing"
import { getAuthHeaders } from "@/src/infrastructure/auth/cookie-fetch"
import type { Resource } from "@buildinlime/domain-types"

// Shared resource-download logic — used by both the Resources section and
// message attachments. Streams the file to disk, then makes it user-visible:
// a public folder on Android (Storage Access Framework), the share sheet's
// "Save to Files" on iOS.

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"

// A folder the user granted write access to via the Android Storage Access
// Framework. Cached for the session so repeat downloads don't re-prompt.
let androidPublicDir: string | null = null

/**
 * Copy a downloaded cache file into a user-chosen public folder on Android.
 * Returns true on success, false if the user declined / it failed (the caller
 * then falls back to the share sheet).
 *
 * The SAF write itself goes base64 (SAF content URIs only accept string
 * writes) — a local disk copy, NOT the network transfer, which was already
 * streamed by downloadAsync.
 */
async function saveToAndroidPublicDir(
  cacheUri: string,
  name: string,
  mimeType: string,
): Promise<boolean> {
  const SAF = FileSystem.StorageAccessFramework
  try {
    if (!androidPublicDir) {
      const perm = await SAF.requestDirectoryPermissionsAsync()
      if (!perm.granted) return false
      androidPublicDir = perm.directoryUri
    }
    const base64 = await FileSystem.readAsStringAsync(cacheUri, {
      encoding: FileSystem.EncodingType.Base64,
    })
    const destUri = await SAF.createFileAsync(androidPublicDir, name, mimeType)
    await FileSystem.writeAsStringAsync(destUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    })
    return true
  } catch {
    // Permission revoked or write failed — drop the cached grant and let the
    // caller fall back to sharing.
    androidPublicDir = null
    return false
  }
}

type DownloadableResource = Pick<
  Resource,
  "name" | "file_location" | "mime_type"
>

export function useResourceDownload() {
  const [downloading, setDownloading] = useState(false)

  async function download(resource: DownloadableResource) {
    if (downloading) return
    setDownloading(true)
    try {
      const url = `${API_URL}${resource.file_location}`
      const cacheUri = `${FileSystem.cacheDirectory}${resource.name}`

      // Stream the response straight to disk. downloadAsync does its own native
      // networking, so it bypasses cookieFetch — auth headers (session cookie +
      // Origin) are passed explicitly via the shared getAuthHeaders builder.
      const headers = await getAuthHeaders()
      const { status } = await FileSystem.downloadAsync(url, cacheUri, { headers })
      if (status !== 200) {
        Alert.alert("Download failed", `Server returned ${status}`)
        return
      }

      // Android: copy into a user-picked public folder so it shows up in the
      // Files app. iOS has no writable public folder — the OS pattern there is
      // the share sheet's "Save to Files", so we share instead.
      if (Platform.OS === "android") {
        const saved = await saveToAndroidPublicDir(
          cacheUri,
          resource.name,
          resource.mime_type,
        )
        if (saved) {
          Alert.alert("Saved", `"${resource.name}" saved to your chosen folder.`)
          return
        }
        // declined / failed — fall through to the share sheet
      }

      const canShare = await Sharing.isAvailableAsync()
      if (canShare) {
        // shareAsync wraps Intent.createChooser on Android, always showing the
        // full chooser sheet (open with + "Save to Files"/Drive/etc.)
        await Sharing.shareAsync(cacheUri, { mimeType: resource.mime_type })
      } else {
        Alert.alert(
          "Downloaded",
          `"${resource.name}" downloaded, but sharing is unavailable on this device.`,
        )
      }
    } catch (err) {
      Alert.alert("Download failed", String(err))
    } finally {
      setDownloading(false)
    }
  }

  return { download, downloading }
}
