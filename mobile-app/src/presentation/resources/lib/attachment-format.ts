// Shared display helpers for attachments — used by the Resources section and
// by message attachments.

export function formatBytes(bytes: number | bigint): string {
  const n = Number(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function mimeEmoji(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️"
  if (mimeType.startsWith("video/")) return "🎬"
  if (mimeType.startsWith("audio/")) return "🎵"
  if (mimeType === "application/pdf") return "📄"
  if (mimeType.includes("word") || mimeType.includes("text")) return "📝"
  return "📎"
}
