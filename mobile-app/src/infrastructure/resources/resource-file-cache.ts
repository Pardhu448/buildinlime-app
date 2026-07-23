import * as FileSystem from "expo-file-system/legacy"
import * as VideoThumbnails from "expo-video-thumbnails"
import { getAuthHeaders } from "@/src/infrastructure/auth/cookie-fetch"

// Persistent on-device cache for resource file bytes and video posters.
//
// Resource files are IMMUTABLE — a resource id maps to fixed bytes (the server's
// object PUT is idempotent, and a deleted resource drops out of sync so it is never
// re-requested), so once a file is on disk it never has to be fetched again. The
// media components used to render straight from the session-guarded remote route
// with per-mount auth headers, which meant every reopen re-hit the network (RN's
// core <Image> does not reliably keep header-bearing responses cached) and every
// video poster was re-decoded from scratch. This module downloads each file ONCE,
// keyed by its immutable resource id, so every component can render from a local
// file:// uri thereafter — no network, no auth gate, no re-decode.
//
// Layer note: the stateful cache lives in infrastructure (not presentation) so the
// application layer can evict a deleted resource without an upward import. The React
// hooks over these functions live in presentation/resources/lib/resource-cache.
//
// Scope note: only fully-materialised media go through here — thumbnails, inline
// images, posters, and small audio clips. Video PLAYBACK deliberately keeps
// streaming from the remote route (progressive), so a large clip starts on the first
// second rather than after a full download.

const FILE_DIR = `${FileSystem.cacheDirectory}resource-files/`
const POSTER_DIR = `${FileSystem.cacheDirectory}resource-posters/`

// In-session memo: remoteUrl -> local uri, so a re-mount resolves synchronously
// instead of paying even a getInfoAsync stat. Cleared with the on-disk cache.
const resolvedFiles = new Map<string, string>()
const resolvedPosters = new Map<string, string>()

// De-dupe concurrent requests for the same file/poster — a list mounts N rows at
// once, so the first caller kicks the work and the rest await the same promise.
const inFlightFiles = new Map<string, Promise<string>>()
const inFlightPosters = new Map<string, Promise<string>>()

let dirsEnsured: Promise<void> | null = null
function ensureDirs(): Promise<void> {
  if (!dirsEnsured) {
    dirsEnsured = (async () => {
      await FileSystem.makeDirectoryAsync(FILE_DIR, { intermediates: true }).catch(() => {})
      await FileSystem.makeDirectoryAsync(POSTER_DIR, { intermediates: true }).catch(() => {})
    })()
  }
  return dirsEnsured
}

// Stable, filesystem-safe key from a resource URL. The URL is always
// `${API_URL}/api/resources/<id>/file`, so the id is the natural key — which also
// lets evictResource(id) find every cache entry for a deleted resource. A djb2 hash
// is the fallback for anything that does not match that shape.
function keyFor(remoteUrl: string): string {
  const m = remoteUrl.match(/resources\/([^/]+)\/file/)
  if (m) return m[1]
  let h = 5381
  for (let i = 0; i < remoteUrl.length; i++) h = ((h << 5) + h + remoteUrl.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/webp": "webp",
  "image/gif": "gif", "video/mp4": "mp4", "video/quicktime": "mov",
  "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/m4a": "m4a", "application/pdf": "pdf",
}
function extFor(mimeType?: string): string {
  if (mimeType && EXT_BY_MIME[mimeType]) return EXT_BY_MIME[mimeType]
  const sub = mimeType?.split("/")[1]
  return sub && /^[a-z0-9]+$/i.test(sub) ? sub : "bin"
}

/** Synchronous peek of the in-session memo — lets a hook resolve without a stat. */
export function peekCachedFile(remoteUrl: string): string | null {
  return resolvedFiles.get(remoteUrl) ?? null
}
export function peekCachedPoster(remoteUrl: string): string | null {
  return resolvedPosters.get(remoteUrl) ?? null
}

/**
 * Ensure the resource file is on disk and return its local file:// uri. Downloads
 * once (deduped); returns the cached uri on every later call.
 */
export async function ensureCachedFile(remoteUrl: string, mimeType?: string): Promise<string> {
  const memo = resolvedFiles.get(remoteUrl)
  if (memo) return memo
  const existing = inFlightFiles.get(remoteUrl)
  if (existing) return existing

  const work = (async () => {
    await ensureDirs()
    const dest = `${FILE_DIR}${keyFor(remoteUrl)}.${extFor(mimeType)}`
    const info = await FileSystem.getInfoAsync(dest)
    if (info.exists && info.size > 0) {
      resolvedFiles.set(remoteUrl, dest)
      return dest
    }
    // Download to a temp path first so an interrupted transfer can't leave a
    // truncated file that a later mount would read as "already cached".
    const tmp = `${dest}.tmp`
    const headers = await getAuthHeaders()
    const { status } = await FileSystem.downloadAsync(remoteUrl, tmp, { headers })
    if (status !== 200) {
      await FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => {})
      throw new Error(`resource download failed: ${status}`)
    }
    await FileSystem.moveAsync({ from: tmp, to: dest })
    resolvedFiles.set(remoteUrl, dest)
    return dest
  })().finally(() => inFlightFiles.delete(remoteUrl))

  inFlightFiles.set(remoteUrl, work)
  return work
}

/**
 * Ensure a poster (first-frame thumbnail) for a video resource is on disk and
 * return its local uri. Decoded ONCE, straight from the remote route — which streams
 * only the bytes it needs for the frame rather than pulling the whole clip down — and
 * the resulting jpg is cached, so every reopen is instant without re-decoding or ever
 * downloading the full video (playback streams separately). Poster is keyed by the
 * resource id alone, so it is shared by the sheet thumbnail and the inline bubble.
 */
export async function ensureCachedPoster(remoteUrl: string): Promise<string> {
  const memo = resolvedPosters.get(remoteUrl)
  if (memo) return memo
  const existing = inFlightPosters.get(remoteUrl)
  if (existing) return existing

  const work = (async () => {
    await ensureDirs()
    const dest = `${POSTER_DIR}${keyFor(remoteUrl)}.jpg`
    const info = await FileSystem.getInfoAsync(dest)
    if (info.exists && info.size > 0) {
      resolvedPosters.set(remoteUrl, dest)
      return dest
    }
    const headers = await getAuthHeaders()
    const { uri: thumb } = await VideoThumbnails.getThumbnailAsync(remoteUrl, { time: 1000, headers })
    await FileSystem.copyAsync({ from: thumb, to: dest })
    resolvedPosters.set(remoteUrl, dest)
    return dest
  })().finally(() => inFlightPosters.delete(remoteUrl))

  inFlightPosters.set(remoteUrl, work)
  return work
}

// Remove every cache entry (memo, in-flight, and on-disk file/poster) for one
// resource id — the id is the on-disk filename prefix, so a delete needs no ext.
async function deleteByPrefix(dir: string, prefix: string): Promise<void> {
  try {
    const entries = await FileSystem.readDirectoryAsync(dir)
    await Promise.all(
      entries
        .filter((name) => name.startsWith(prefix))
        .map((name) => FileSystem.deleteAsync(`${dir}${name}`, { idempotent: true }).catch(() => {})),
    )
  } catch {
    // dir may not exist yet — nothing cached for this id, nothing to evict.
  }
}

/**
 * Purge the cached bytes + poster for a deleted resource, so the server's
 * "soft-deleted files return 404" guarantee is honoured on-device too rather than
 * leaving the local copy readable until sign-out. Called when a resource is deleted.
 */
export async function evictResource(resourceId: string): Promise<void> {
  for (const url of [...resolvedFiles.keys()]) if (keyFor(url) === resourceId) resolvedFiles.delete(url)
  for (const url of [...resolvedPosters.keys()]) if (keyFor(url) === resourceId) resolvedPosters.delete(url)
  for (const url of [...inFlightFiles.keys()]) if (keyFor(url) === resourceId) inFlightFiles.delete(url)
  for (const url of [...inFlightPosters.keys()]) if (keyFor(url) === resourceId) inFlightPosters.delete(url)
  await Promise.all([
    deleteByPrefix(FILE_DIR, `${resourceId}.`),
    deleteByPrefix(POSTER_DIR, `${resourceId}.`),
  ])
}

/**
 * Wipe the on-disk resource cache. Called at sign-out (fire-and-forget) so the next
 * user on the device never inherits the previous one's cached media.
 */
export async function clearResourceFileCache(): Promise<void> {
  resolvedFiles.clear()
  resolvedPosters.clear()
  inFlightFiles.clear()
  inFlightPosters.clear()
  dirsEnsured = null
  await FileSystem.deleteAsync(FILE_DIR, { idempotent: true }).catch(() => {})
  await FileSystem.deleteAsync(POSTER_DIR, { idempotent: true }).catch(() => {})
}
