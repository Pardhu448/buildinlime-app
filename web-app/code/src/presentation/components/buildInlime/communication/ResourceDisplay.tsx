import { useState, useEffect } from "react"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { Download, X, Trash2 } from "lucide-react"
import { useSession } from "%/infrastructure/auth/client"
import { resourcesCollection, tasksCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { deleteResourceAction } from "%/application/actions/resources"
import { formatDateTime } from "%/presentation/lib/datetime"
import { ResourceThumbnail } from "./ResourceThumbnail"

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

// The shape of a row as it arrives from the resources collection.
type ResourceRow = {
  id: string
  name: string
  mime_type: string
  file_location: string
  uploaded_at: string | Date
  createdby_id: string
  message_id?: string | null
  task_id?: string | null
}

interface ResourceCardProps {
  resource: ResourceRow
  subtitle?: string
  canDelete: boolean
  onDelete: (id: string, name: string) => void
  onDismiss: (id: string) => void
}

function ResourceCard({ resource: r, subtitle, canDelete, onDelete, onDismiss }: ResourceCardProps) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 bg-card-surface border border-card-border rounded">
      <ResourceThumbnail fileLocation={r.file_location} mimeType={r.mime_type} size={36} />

      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate" title={r.name}>
          {r.name}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">
          {formatDateTime(r.uploaded_at)}
          {subtitle ? ` · ${subtitle}` : ``}
        </p>
      </div>

      <a
        href={r.file_location}
        download
        title="Download"
        className="p-0.5 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
      </a>

      {/* Delete for EVERYONE — distinct from the X, which only hides the row from
          this user's own view. Uploader or task creator; the server enforces it. */}
      {canDelete && (
        <button
          onClick={() => onDelete(r.id, r.name)}
          title="Delete for everyone"
          className="p-0.5 text-muted-foreground hover:text-red-700 transition-colors flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
      <button
        onClick={() => onDismiss(r.id)}
        title="Hide from my view (does not delete)"
        className="p-0.5 text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function Column({
  title,
  count,
  empty,
  children,
}: {
  title: string
  count: number
  empty: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-w-0 border border-card-border rounded bg-white/40">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-card-border">
        <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
        <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>
      </div>
      {/* Each column scrolls on its OWN, so a channel with 50 message attachments
          cannot push the task column (or the comments below) off the page. */}
      <div className="max-h-64 overflow-y-auto p-2 space-y-1.5">
        {count === 0 ? <p className="text-xs text-muted-foreground py-1">{empty}</p> : children}
      </div>
    </div>
  )
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

  // Every task in this channel, keyed by id. This panel spans the whole channel, so
  // a row may belong to any task and must resolve its own to know who may delete it
  // and which task to name.
  const { data: channelTasks } = useLiveQuery(
    (q) =>
      q
        .from({ tasksCollection })
        .where(({ tasksCollection: t }) => eq(t.channel_id, channelId ?? "")),
    [channelId]
  )
  // The `| undefined` in these casts is deliberate: useLiveQuery types its data as a
  // plain array, but it really is undefined on the first render before the query has
  // resolved — so the ?? [] is load-bearing, not defensive noise.
  const taskRows =
    (channelTasks as { id: string; name?: string; createdby_id?: string }[] | undefined) ?? []
  const taskById = new Map(taskRows.map((t) => [t.id, t]))

  const visible = ((rawResources as ResourceRow[] | undefined) ?? [])
    .filter((r) => !hiddenIds.has(r.id))
    .sort(
      (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
    )

  // Split by where the file came from. Standalone rows (neither a message nor a task)
  // are a legacy category — nothing creates them any more, now that a file enters a
  // channel only through a message or a task — so they ride along with the messages
  // column rather than earning a third one that would be empty for every new channel.
  const fromMessages = visible.filter((r) => !r.task_id)
  const fromTasks = visible.filter((r) => !!r.task_id)

  const dismiss = (id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev).add(id)
      if (userId) saveHidden(userId, next)
      return next
    })
  }

  // Uploader, or the creator of the task the file hangs off — the same rule the
  // server enforces (routers/resources.ts). Hiding the button is courtesy.
  const canDelete = (r: ResourceRow) =>
    r.createdby_id === userId ||
    (!!r.task_id && taskById.get(r.task_id)?.createdby_id === userId)

  const confirmDelete = (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? It is removed for everyone.`)) return
    deleteResourceAction({ id })
  }

  if (visible.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No files in this channel yet. Attach one to a message or a task.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Column
        title="From messages"
        count={fromMessages.length}
        empty="No files attached to a message yet."
      >
        {fromMessages.map((r) => (
          <ResourceCard
            key={r.id}
            resource={r}
            canDelete={canDelete(r)}
            onDelete={confirmDelete}
            onDismiss={dismiss}
          />
        ))}
      </Column>

      <Column
        title="From tasks"
        count={fromTasks.length}
        empty="No files attached to a task yet."
      >
        {fromTasks.map((r) => (
          <ResourceCard
            key={r.id}
            resource={r}
            subtitle={taskById.get(r.task_id!)?.name ?? "task"}
            canDelete={canDelete(r)}
            onDelete={confirmDelete}
            onDismiss={dismiss}
          />
        ))}
      </Column>
    </div>
  )
}
