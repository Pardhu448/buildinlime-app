import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronRight,
  ChevronDown,
  Link as LinkIcon,
  Check,
  PanelRight,
  Hammer,
  Trash2,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { deleteTaskAction } from "%/application/actions/tasks";
import {
  Sidebar,
  ChannelHeader,
  PropertiesInline,
  ResourcesSection,
  AssignedToSection,
  TaskStatusSection,
  PropertiesPanel,
} from "../components/buildInlime";
import { formatDateTime } from "%/presentation/lib/datetime";
import type { Property } from "%/domain/communication/types";

interface TaskPageProps {
  projectId: string;
  projectName: string;
  buildUnitName: string;
  buildUnitId: string;
  channelName: string;
  channelId: string;
  taskId: string;
  taskName: string;
  taskDescription: string;
  /** tasks.completed — only a fallback for TaskStatusSection. See use-task-route. */
  completed: boolean;
  properties: Property[];
  channelMemberIds: string[];
  currentAssigneeId: string | null;
  currentUserId: string;
  createdByName: string;
  createdAt?: Date | string;
  canAssign: boolean;
}

export function TaskPage({
  projectId,
  projectName,
  buildUnitName,
  buildUnitId,
  channelName,
  channelId,
  taskId,
  taskName,
  taskDescription,
  completed,
  properties,
  channelMemberIds,
  currentAssigneeId,
  currentUserId,
  createdByName,
  createdAt,
  canAssign,
}: TaskPageProps) {
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const navigate = useNavigate();

  // Creator only. The server enforces it (tasks.delete returns FORBIDDEN otherwise)
  // — hiding the button is courtesy, not the control. canAssign is the same rule.
  const confirmDelete = () => {
    if (
      !window.confirm(
        `Delete "${taskName}"? The task and its attachments are removed for everyone. Notes already posted to the channel stay there.`,
      )
    )
      return;
    deleteTaskAction({ id: taskId });
    // The task falls out of the Electric shape, so this page would render
    // "not found" — leave before that happens.
    navigate({
      to: "/projects/$projectId/$buildUnitName/$channelName",
      params: { projectId, buildUnitName, channelName },
    });
  };

  // No per-task "seen" write anymore: task seen-ness is per-channel and chronological
  // (see useSeen). Leaving the channel marks its tasks seen — and navigating into a
  // task unmounts the channel, so that path is already covered.

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  };
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [taskPropsOpen, setTaskPropsOpen] = useState(true);

  return (
    <div className="flex h-screen bg-white font-['Instrument_Sans',sans-serif]">
      {/* Sidebar */}
      <Sidebar projectId={projectId} />

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top navigation bar */}
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
                href={`/projects/${projectId}/${buildUnitName}`}
                className="hover:text-foreground transition-colors"
              >
                {buildUnitName}
              </Link>
              <ChevronRight className="w-4 h-4" />
              <Link
                href={`/projects/${projectId}/${buildUnitName}/${channelName}`}
                className="hover:text-foreground transition-colors"
              >
                {channelName}
              </Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-foreground">{taskName}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLink}
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
              {canAssign && (
                <button
                  onClick={confirmDelete}
                  title="Delete this task"
                  className="p-1.5 text-muted-foreground hover:text-red-700 hover:bg-gray-100 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                className="p-1.5 text-muted-foreground hover:bg-gray-100 rounded transition-colors"
              >
                <PanelRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Content area */}
          <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
            <ChannelHeader icon={Hammer} title={taskName} description={taskDescription} />

            {/* Properties inline */}
            <PropertiesInline properties={properties} entityId={taskId} entity="task" channelId={channelId} />

            {/* Who created this, and when. Also the basis for the assignment
                restriction below — only the creator may assign. */}
            <div className="flex items-center gap-0 py-2">
              <span className="text-sm text-muted-foreground w-32 shrink-0">Created By</span>
              <span className="text-sm text-foreground">{createdByName}</span>
              {createdAt && (
                <span className="text-sm text-muted-foreground ml-2">
                  · {formatDateTime(createdAt)}
                </span>
              )}
            </div>

            {/* Assigned To */}
            <AssignedToSection
              taskId={taskId}
              currentAssigneeId={currentAssigneeId}
              channelMemberIds={channelMemberIds}
              canAssign={canAssign}
            />

            {/* Status — the ONLY way to change it. PropertiesInline no longer
                offers taskStatus, so a status change always carries a note. */}
            <TaskStatusSection
              taskId={taskId}
              taskName={taskName}
              channelId={channelId}
              buildUnitId={buildUnitId}
              projectId={projectId}
              currentUserId={currentUserId}
              properties={properties}
              completed={completed}
            />

            {/* Resources */}
            <ResourcesSection
              channelId={channelId}
              taskId={taskId}
              buildunitId={buildUnitId}
              projectId={projectId}
              createdbyId={currentUserId}
              memberIds={channelMemberIds.length > 0 ? channelMemberIds : [currentUserId]}
            />
          </div>

          {/* Right panel */}
          {rightPanelOpen && (
            <aside className="w-72 bg-card-surface border-l border-card-border overflow-y-auto p-6 space-y-8">
              {/* Properties */}
              <div>
                <button
                  onClick={() => setPropertiesOpen(!propertiesOpen)}
                  className="flex items-center justify-between w-full mb-4"
                >
                  <h3 className="text-sm font-medium text-muted-foreground">Properties</h3>
                  {propertiesOpen
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  }
                </button>
                {propertiesOpen && (
                  <div>
                    {/* Task sub-section */}
                    <button
                      onClick={() => setTaskPropsOpen(!taskPropsOpen)}
                      className="flex items-center justify-between w-full mb-3"
                    >
                      <p className="text-xs text-secondary">Task</p>
                      {taskPropsOpen
                        ? <ChevronDown className="w-3 h-3 text-secondary" />
                        : <ChevronRight className="w-3 h-3 text-secondary" />
                      }
                    </button>
                    {taskPropsOpen && (
                      <PropertiesPanel properties={properties} entityId={taskId} hideLabel hideAddButton />
                    )}
                  </div>
                )}
              </div>

              {/* Details */}
              <div>
                <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">Details</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Channel</span>
                    <span className="text-sm text-foreground">{channelName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Build Unit</span>
                    <span className="text-sm text-foreground">{buildUnitName}</span>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
