import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Hammer } from "lucide-react";
import { deleteTaskAction } from "%/application/actions/tasks";
import {
  Sidebar,
  ChannelHeader,
  PropertiesInline,
  ResourcesSection,
  AssignedToSection,
  TaskStatusSection,
} from "../components/buildInlime";
import { TaskPageHeader } from "../components/buildInlime/task/TaskPageHeader";
import { TaskPropertiesSection } from "../components/buildInlime/task/TaskPropertiesSection";
import { TaskDetailsSection } from "../components/buildInlime/task/TaskDetailsSection";
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
  // Right-panel collapse state lives here (not in TaskPropertiesSection) so it
  // survives hiding/showing the panel, which unmounts the aside.
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [taskPropsOpen, setTaskPropsOpen] = useState(true);
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

  return (
    <div className="flex h-screen bg-white font-['Instrument_Sans',sans-serif]">
      {/* Sidebar */}
      <Sidebar projectId={projectId} />

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <TaskPageHeader
          projectId={projectId}
          projectName={projectName}
          buildUnitName={buildUnitName}
          channelName={channelName}
          taskName={taskName}
          canDelete={canAssign}
          onDelete={confirmDelete}
          linkCopied={linkCopied}
          onCopyLink={handleCopyLink}
          onToggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)}
        />

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
            />
          </div>

          {/* Right panel */}
          {rightPanelOpen && (
            <aside className="w-72 bg-card-surface border-l border-card-border overflow-y-auto p-6 space-y-8">
              <TaskPropertiesSection
                properties={properties}
                taskId={taskId}
                propertiesOpen={propertiesOpen}
                setPropertiesOpen={setPropertiesOpen}
                taskPropsOpen={taskPropsOpen}
                setTaskPropsOpen={setTaskPropsOpen}
              />
              <TaskDetailsSection channelName={channelName} buildUnitName={buildUnitName} />
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
