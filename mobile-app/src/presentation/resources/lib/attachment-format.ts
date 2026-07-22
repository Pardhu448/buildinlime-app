// Shared display helpers for attachments — used by the Resources sheet and by
// message attachments. Type iconography now lives in ResourceThumbnail, which
// renders a real preview of the uploaded file rather than a per-mime glyph.

export function formatBytes(bytes: number | bigint): string {
  const n = Number(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Split "report.final.pdf" into ["report.final", ".pdf"]. Renaming UIs hold the
 * extension back from editing — it drives how the file opens once downloaded,
 * and a user renaming a .pdf to "notes" should not get an extensionless file.
 */
export function splitExtension(name: string): [string, string] {
  const dot = name.lastIndexOf(".")
  if (dot <= 0 || dot === name.length - 1) return [name, ""]
  return [name.slice(0, dot), name.slice(dot)]
}

export type MediaKind = "image" | "video" | "audio"

/**
 * The kind of inline player a mime type gets in a message bubble, or null for
 * the download-chip fallback (pdf, docs, anything not media). Picture/audio/video
 * render inline; everything else stays a tappable file chip.
 */
export function mediaKind(mimeType: string): MediaKind | null {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("video/")) return "video"
  if (mimeType.startsWith("audio/")) return "audio"
  return null
}

/** mm:ss for a seconds value; used by the audio/video scrubbers. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}
