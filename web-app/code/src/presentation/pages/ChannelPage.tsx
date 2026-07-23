import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useSeen } from "%/presentation/hooks/use-seen";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Sidebar,
  ChannelHeader,
  PropertiesInline,
  AddTaskButton,
  CommentsSection,
  TasksRightPanel,
  PageTopBar,
} from "../components/buildInlime";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "../components/ui/alert-dialog";
import { ChannelAddPeoplePopover } from "../components/buildInlime/channel/ChannelAddPeoplePopover";
import { ChannelResourcesSection } from "../components/buildInlime/channel/ChannelResourcesSection";
import { ChannelPropertiesSection } from "../components/buildInlime/channel/ChannelPropertiesSection";
import { ChannelMembersList } from "../components/buildInlime/channel/ChannelMembersList";
import { AddTaskModal } from "../components/buildInlime/channel/AddTaskModal";
import { useChannelPage } from "../hooks/use-channel-page";
import type { Property } from "%/domain/communication/types";

interface ChannelPageProps {
  projectId: string;
  projectName: string;
  buildUnitName: string;
  buildUnitId: string;
  channelName: string;
  channelId: string;
  icon: LucideIcon;
  title: string;
  description: string;
  properties: Property[];
  buildUnitProperties: Property[];
  /** ?messageId= from the Inbox — scroll to and highlight this message. */
  focusMessageId?: string;
}

export function ChannelPage({
  projectId,
  projectName,
  buildUnitName,
  buildUnitId,
  channelName,
  channelId,
  icon,
  title,
  description,
  properties,
  buildUnitProperties,
  focusMessageId,
}: ChannelPageProps) {
  // UI-only toggle state. The right-panel collapse states live here (not in the
  // sub-panels) so they survive hiding/showing the panel, which unmounts it.
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [channelPropsOpen, setChannelPropsOpen] = useState(true);
  const [buildUnitPropsOpen, setBuildUnitPropsOpen] = useState(true);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [addPeopleOpen, setAddPeopleOpen] = useState(false);

  const {
    currentUserId,
    isOwner,
    channelOwnerId,
    channelMembers,
    nonMembers,
    isAddingMember,
    confirmRemoveId,
    setConfirmRemoveId,
    removalError,
    setRemovalError,
    alreadyMemberName,
    setAlreadyMemberName,
    tasks,
    dbTasksReady,
    taskName,
    setTaskName,
    taskDesc,
    setTaskDesc,
    isSubmittingTask,
    taskNameTaken,
    handleAddMember,
    handleRemoveMember,
    handleAddTask,
    handleTaskClick,
  } = useChannelPage(channelId, buildUnitId, projectId, buildUnitName, channelName);

  const { isTaskUnseen, markChannelSeen } = useSeen();

  // Mark the channel seen on LEAVE (unmount or channel switch). While you are in
  // the channel, tasks that arrived since your last visit show bold; advancing
  // the timestamp on the way out clears them for next time. There is no
  // per-message seen state anymore — Inbox mentions are handled by the Inbox's
  // own seen marker, so arriving here from an Inbox deep link no longer needs to
  // mark anything (focusMessageId still drives the scroll-to-message below).
  useEffect(() => {
    if (!channelId) return;
    return () => markChannelSeen(channelId);
  }, [channelId, markChannelSeen]);

  if (!dbTasksReady) return null;

  const onAddTask = async (e: FormEvent) => {
    await handleAddTask(e);
    setTaskFormOpen(false);
  };

  return (
    <>
    <div className="flex h-screen bg-white font-['Instrument_Sans',sans-serif]">
      {/* Sidebar */}
      <Sidebar projectId={projectId} />

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <PageTopBar
          onToggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)}
          breadcrumbs={
            <>
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
              <span className="text-foreground">{channelName}</span>
            </>
          }
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Content area */}
          <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
            <ChannelHeader icon={icon} title={title} description={description} />

            {/* Properties inline */}
            <PropertiesInline properties={properties} entityId={channelId} entity="channel" />

            {/* Add Task + Add People */}
            <div className="relative">
              <AddTaskButton
                onClick={() => setTaskFormOpen(true)}
                onAddPeople={isOwner ? () => setAddPeopleOpen((v) => !v) : undefined}
              />
              <ChannelAddPeoplePopover
                open={addPeopleOpen}
                onClose={() => setAddPeopleOpen(false)}
                nonMembers={nonMembers}
                isAddingMember={isAddingMember}
                onAddMember={handleAddMember}
              />
            </div>

            {/* Resources */}
            <ChannelResourcesSection channelId={channelId} buildUnitId={buildUnitId} />

            {/* Comments section */}
            <div className="mt-8">
              <CommentsSection
                channelId={channelId}
                buildunitId={buildUnitId}
                projectId={projectId}
                currentUserId={currentUserId}
                memberIds={channelMembers.map(u => u.id)}
                buildUnitName={buildUnitName}
                channelName={channelName}
                focusMessageId={focusMessageId}
              />
            </div>
          </div>

          {/* Right panel */}
          {rightPanelOpen && (
            <aside className="w-72 bg-card-surface border-l border-card-border overflow-y-auto p-6 space-y-8">
              <ChannelPropertiesSection
                channelProperties={properties}
                channelId={channelId}
                buildUnitProperties={buildUnitProperties}
                buildUnitId={buildUnitId}
                buildUnitName={buildUnitName}
                propertiesOpen={propertiesOpen}
                setPropertiesOpen={setPropertiesOpen}
                channelPropsOpen={channelPropsOpen}
                setChannelPropsOpen={setChannelPropsOpen}
                buildUnitPropsOpen={buildUnitPropsOpen}
                setBuildUnitPropsOpen={setBuildUnitPropsOpen}
              />

              {/* Tasks */}
              <TasksRightPanel
                tasks={tasks}
                onTaskClick={handleTaskClick}
                isUnread={isTaskUnseen}
              />

              <ChannelMembersList
                members={channelMembers}
                isOwner={isOwner}
                channelOwnerId={channelOwnerId}
                confirmRemoveId={confirmRemoveId}
                setConfirmRemoveId={setConfirmRemoveId}
                onRemoveMember={handleRemoveMember}
              />
            </aside>
          )}
        </div>
      </main>
    </div>

      {/* Add Task modal */}
      <AddTaskModal
        open={taskFormOpen}
        onClose={() => setTaskFormOpen(false)}
        onSubmit={onAddTask}
        taskName={taskName}
        setTaskName={setTaskName}
        taskDesc={taskDesc}
        setTaskDesc={setTaskDesc}
        isSubmitting={isSubmittingTask}
        taskNameTaken={taskNameTaken}
      />

      {/* Remove member error dialog */}
      <AlertDialog open={!!removalError} onOpenChange={(open) => { if (!open) setRemovalError(null); }}>
        <AlertDialogContent>
          <AlertDialogTitle>Remove failed</AlertDialogTitle>
          <AlertDialogDescription>{removalError}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setRemovalError(null)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Already a member dialog */}
      <AlertDialog open={!!alreadyMemberName} onOpenChange={(open) => { if (!open) setAlreadyMemberName(null); }}>
        <AlertDialogContent>
          <AlertDialogTitle>Already a member</AlertDialogTitle>
          <AlertDialogDescription>
            {alreadyMemberName} is already a member of this channel.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAlreadyMemberName(null)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
