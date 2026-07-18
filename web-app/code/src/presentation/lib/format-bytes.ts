/** Human-readable byte size: "512 B", "1.5 KB", "3.2 MB". */
export function formatBytes(bytes: number | bigint) {
  const n = Number(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
