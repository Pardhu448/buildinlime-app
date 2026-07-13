import { useState, useEffect } from "react"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { Download, FileText, Image, Video, Music, File, X } from "lucide-react"
import { useSession } from "%/infrastructure/auth/client"
import { resourcesCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { formatDateTime } from "%/presentation/lib/datetime"

export interface ResourceDisplayProps {
  channelId: string | null
  buildunitId: string
}

function storageKey(userId: string) {
  return `hidden_resources_${userId}`
}

function loadHidden(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function saveHidden(userId: string, ids: Set<string>) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify([...ids]))
  } catch {
    // localStorage unavailable — silently ignore
  }
}

function mimeIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <Image className="w-3 h-3 text-[#976623]" />
  if (mimeType.startsWith("video/")) return <Video className="w-3 h-3 text-[#976623]" />
  if (mimeType.startsWith("audio/")) return <Music className="w-3 h-3 text-[#976623]" />
  if (mimeType === "application/pdf" || mimeType.includes("word") || mimeType.includes("text"))
    return <FileText className="w-3 h-3 text-[#976623]" />
  return <File className="w-3 h-3 text-[#717182]" />
}

export function ResourceDisplay({ channelId, buildunitId }: ResourceDisplayProps) {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? ""

  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() =>
    userId ? loadHidden(userId) : new Set()
  )

  // Re-load from localStorage once userId is available (first render may be empty string)
  useEffect(() => {
    if (userId) setHiddenIds(loadHidden(userId))
  }, [userId])

  const { data: rawResources } = useLiveQuery(
    (q) =>
      channelId
        ? q.from({ resourcesCollection }).where(({ resourcesCollection: r }) => eq(r.channel_id, channelId))
        : q.from({ resourcesCollection }).where(({ resourcesCollection: r }) => eq(r.buildunit_id, buildunitId)),
    [channelId, buildunitId]
  )

  const resources = (rawResources ?? []).filter((r) => !hiddenIds.has(r.id))

  const dismiss = (id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev).add(id)
      if (userId) saveHidden(userId, next)
      return next
    })
  }

  if (resources.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {resources.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#fdf8f2] border border-[#e5d4c1] rounded text-sm min-w-[180px] max-w-[240px]"
        >
          {mimeIcon(r.mime_type)}
          <div className="flex-1 min-w-0">
            <p className="text-[#1e1e1e] truncate" title={r.name}>
              {r.name}
            </p>
            <p className="text-[10px] text-[#717182]">{formatDateTime(r.uploaded_at)}</p>
          </div>
          <a
            href={r.file_location}
            download
            title="Download"
            className="p-0.5 text-[#717182] hover:text-[#1e1e1e] transition-colors flex-shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={() => dismiss(r.id)}
            title="Remove from view"
            className="p-0.5 text-[#717182] hover:text-[#976623] transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
