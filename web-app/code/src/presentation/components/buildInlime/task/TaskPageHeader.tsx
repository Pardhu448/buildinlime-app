import { Link } from "@tanstack/react-router"
import { ChevronRight, Link as LinkIcon, Check, PanelRight, Trash2 } from "lucide-react"

export interface TaskPageHeaderProps {
  projectId: string
  projectName: string
  buildUnitName: string
  channelName: string
  taskName: string
  canDelete: boolean
  onDelete: () => void
  linkCopied: boolean
  onCopyLink: () => void
  onToggleRightPanel: () => void
}

/** The task page's top bar: breadcrumbs plus copy-link, delete, and right-panel
 *  toggle actions. */
export function TaskPageHeader({
  projectId,
  projectName,
  buildUnitName,
  channelName,
  taskName,
  canDelete,
  onDelete,
  linkCopied,
  onCopyLink,
  onToggleRightPanel,
}: TaskPageHeaderProps) {
  return (
    <header className="border-b border-gray-200 bg-white px-6 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Link
            to="/projects/$projectId"
            params={{ projectId }}
            className="hover:text-foreground transition-colors"
          >
            {projectName}
          </Link>
          <ChevronRight className="w-4 h-4" />
          <Link
            to="/projects/$projectId/$buildUnitName"
            params={{ projectId, buildUnitName }}
            className="hover:text-foreground transition-colors"
          >
            {buildUnitName}
          </Link>
          <ChevronRight className="w-4 h-4" />
          <Link
            to="/projects/$projectId/$buildUnitName/$channelName"
            params={{ projectId, buildUnitName, channelName }}
            className="hover:text-foreground transition-colors"
          >
            {channelName}
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">{taskName}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCopyLink}
            title="Copy link"
            className={`p-1.5 rounded transition-colors ${linkCopied ? "text-green-600 bg-green-50" : "text-muted-foreground hover:bg-gray-100"}`}
          >
            {linkCopied ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
          </button>
          {/*
            FUTURE WORK: the notifications bell is a non-functional
            placeholder, hidden until built. Intended behaviour (deferred —
            see two open questions below before building):
              1) Toggling the bell subscribes the current user to the build
                 unit; while enabled, its activities are relayed to their
                 "Updates" page (new page + sidebar entry below "My Tasks",
                 styled like Inbox / My Tasks).
              2) Tracked activities: new channel created, new property added.
              3) Each Update is tagged with the build unit's icon and name.
            Open questions: (a) does enabling show past activity or only new
            activity going forward? (b) does "new property added" include
            properties on the build unit's channels/tasks, or build-unit-level
            only? Likely stack: activities + build_unit_subscriptions synced
            tables, activity rows emitted in the channels.create /
            properties.create tRPC mutations.

            <button className="p-1.5 text-muted-foreground hover:bg-gray-100 rounded transition-colors">
              <Bell className="w-4 h-4" />
            </button>
          */}
          {canDelete && (
            <button
              onClick={onDelete}
              title="Delete this task"
              className="p-1.5 text-muted-foreground hover:text-red-700 hover:bg-gray-100 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onToggleRightPanel}
            className="p-1.5 text-muted-foreground hover:bg-gray-100 rounded transition-colors"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
