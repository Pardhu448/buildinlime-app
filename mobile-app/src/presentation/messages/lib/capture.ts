import * as ImagePicker from "expo-image-picker"
import * as DocumentPicker from "expo-document-picker"

// Normalised media capture for the composer. Each entry point returns a single
// CapturedFile ready to hand to enqueueUpload, or null when the user backs out.
// Permission denials throw with a user-facing message the caller Alerts.

export interface CapturedFile {
  uri: string
  name: string
  mimeType: string
}

export class PermissionDeniedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PermissionDeniedError"
  }
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
}

function extFor(mimeType: string): string {
  if (EXT_BY_MIME[mimeType]) return EXT_BY_MIME[mimeType]
  // e.g. "image/gif" → "gif"; falls back to a generic bin for unknowns.
  const sub = mimeType.split("/")[1]
  return sub && /^[a-z0-9]+$/i.test(sub) ? sub : "bin"
}

// A capture from the camera/library has no filename of its own; synthesize a
// stable, human-readable one so the attachment and any later download read well.
function synthName(prefix: string, mimeType: string): string {
  return `${prefix}-${Date.now()}.${extFor(mimeType)}`
}

// The picker gives `type` ('image'|'video') reliably but `mimeType` only
// sometimes — fall back to a sensible default so the message renders inline.
function mimeForAsset(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType
  return asset.type === "video" ? "video/mp4" : "image/jpeg"
}

function normalize(asset: ImagePicker.ImagePickerAsset, prefix: string): CapturedFile {
  const mimeType = mimeForAsset(asset)
  return {
    uri: asset.uri,
    name: asset.fileName ?? synthName(prefix, mimeType),
    mimeType,
  }
}

/** Take a photo or record a video with the device camera. */
export async function captureFromCamera(media: "images" | "videos"): Promise<CapturedFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync()
  if (!perm.granted) {
    throw new PermissionDeniedError("Camera access is off. Enable it in Settings to capture media.")
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: [media],
    quality: 0.8,
  })
  if (result.canceled) return null
  const asset = result.assets[0]
  if (!asset) return null
  return normalize(asset, media === "videos" ? "video" : "photo")
}

/** Pick an existing photo or video from the device library. */
export async function pickFromLibrary(): Promise<CapturedFile | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) {
    throw new PermissionDeniedError("Photo library access is off. Enable it in Settings to attach media.")
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    quality: 0.8,
  })
  if (result.canceled) return null
  const asset = result.assets[0]
  if (!asset) return null
  return normalize(asset, asset.type === "video" ? "video" : "photo")
}

/** Pick any file (pdf, docs, …) — the pre-existing attach behaviour. */
export async function pickDocument(): Promise<CapturedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true })
  if (result.canceled) return null
  const asset = result.assets[0]
  if (!asset) return null
  return {
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? "application/octet-stream",
  }
}
