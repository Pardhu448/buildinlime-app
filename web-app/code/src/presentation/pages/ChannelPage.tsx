import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useReads } from "%/presentation/hooks/use-reads";
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Sidebar,
  ChannelHeader,
  PropertiesInline,
  AddTaskButton,
  ResourceDisplay,
  CommentsSection,
  TasksRightPanel,
  PageTopBar,
} from "../components/buildInlime";
import { PropertiesPanel } from "../components/buildInlime";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "../components/ui/alert-dialog";
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
  // UI-only toggle state
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [channelPropsOpen, setChannelPropsOpen] = useState(true);
  const [buildUnitPropsOpen, setBuildUnitPropsOpen] = useState(true);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(true);
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
    handleAddMember,
    handleRemoveMember,
    handleAddTask,
    handleTaskClick,
  } = useChannelPage(channelId, buildUnitId, projectId, buildUnitName, channelName);

  // Tasks are marked opened by TaskPage itself, not here — that way every route
  // into a task counts, not just the ones that remembered to call it.
  const { isTaskUnread, markChannelMessagesRead, markMessageRead } = useReads();

  // Arriving from the Inbox on a specific message marks that one read even if
  // the bulk pass below has not caught it yet.
  useEffect(() => {
    if (!focusMessageId || !channelId) return;
    markMessageRead(focusMessageId, channelId);
  }, [focusMessageId, channelId, markMessageRead]);

  // Opening a channel marks its messages read — bulk, because nobody clicks each
  // message. Runs on every message change too, so messages that arrive while you
  // are sitting in the channel are marked read as they land rather than
  // accumulating an unread count on a channel you are literally looking at.
  useEffect(() => {
    if (!channelId) return;
    markChannelMessagesRead(channelId);
  }, [channelId, markChannelMessagesRead]);

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
                className="hover:text-[#1e1e1e] transition-colors"
              >
                {projectName}
              </Link>
              <ChevronRight className="w-4 h-4" />
              <Link
                to="/projects/$projectId/$buildUnitName"
                params={{ projectId, buildUnitName }}
                className="hover:text-[#1e1e1e] transition-colors"
              >
                {buildUnitName}
              </Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-[#1e1e1e]">{channelName}</span>
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
              {addPeopleOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setAddPeopleOpen(false)}
                  />
                  <div className="absolute left-24 top-0 z-20 bg-white border border-[#e5d4c1] rounded-lg shadow-lg min-w-[220px]">
                    <p className="px-3 py-2 text-xs font-medium text-[#717182] border-b border-[#e5d4c1]">
                      Add to channel
                    </p>
                    {nonMembers.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-[#717182]">All users are already members.</p>
                    ) : (
                      <div className="py-1 max-h-48 overflow-y-auto">
                        {nonMembers.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => handleAddMember(u.id, () => setAddPeopleOpen(false))}
                            disabled={isAddingMember}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1e1e1e] hover:bg-[#fdf8f2] transition-colors disabled:opacity-50"
                          >
                            <div className="w-6 h-6 rounded-full bg-[#e5d4c1] flex items-center justify-center text-[#976623] text-xs font-medium flex-shrink-0">
                              {((u.name || u.email || "?")[0] ?? "?").toUpperCase()}
                            </div>
                            <span className="truncate">{u.name || u.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Resources */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-[#717182]">Resources</h3>
                <button
                  onClick={() => setResourcesOpen(!resourcesOpen)}
                  className="flex items-center gap-1 text-xs text-[#717182] hover:text-[#976623] transition-colors"
                >
                  {resourcesOpen ? (
                    <>Hide <ChevronUp className="w-3.5 h-3.5" /></>
                  ) : (
                    <>Show <ChevronDown className="w-3.5 h-3.5" /></>
                  )}
                </button>
              </div>
              {resourcesOpen && (
                <ResourceDisplay
                  channelId={channelId}
                  buildunitId={buildUnitId}
                />
              )}
            </div>

            {/* Comments section */}
            <div className="mt-8">
              <CommentsSection
                channelId={channelId}
                buildunitId={buildUnitId}
                projectId={projectId}
                currentUserId={currentUserId}
                memberIds={channelMembers.map(u => u.id)}
                focusMessageId={focusMessageId}
              />
            </div>
          </div>

          {/* Right panel */}
          {rightPanelOpen && (
            <aside className="w-72 bg-[#fdf8f2] border-l border-[#e5d4c1] overflow-y-auto p-6 space-y-8">
              {/* Properties */}
              <div>
                <button
                  onClick={() => setPropertiesOpen(!propertiesOpen)}
                  className="flex items-center justify-between w-full mb-4"
                >
                  <h3 className="text-sm font-medium text-[#717182]">Properties</h3>
                  {propertiesOpen
                    ? <ChevronDown className="w-4 h-4 text-[#717182]" />
                    : <ChevronRight className="w-4 h-4 text-[#717182]" />
                  }
                </button>
                {propertiesOpen && (
                  <div className="space-y-6">
                    {/* Channel sub-section */}
                    <div>
                      <button
                        onClick={() => setChannelPropsOpen(!channelPropsOpen)}
                        className="flex items-center justify-between w-full mb-3"
                      >
                        <p className="text-xs text-[#ac7f5e]">Channel</p>
                        {channelPropsOpen
                          ? <ChevronDown className="w-3 h-3 text-[#ac7f5e]" />
                          : <ChevronRight className="w-3 h-3 text-[#ac7f5e]" />
                        }
                      </button>
                      {channelPropsOpen && (
                        <PropertiesPanel properties={properties} entityId={channelId} hideLabel hideAddButton />
                      )}
                    </div>
                    {/* Build Unit sub-section */}
                    <div>
                      <button
                        onClick={() => setBuildUnitPropsOpen(!buildUnitPropsOpen)}
                        className="flex items-center justify-between w-full mb-3"
                      >
                        <p className="text-xs text-[#ac7f5e]">Build Unit</p>
                        {buildUnitPropsOpen
                          ? <ChevronDown className="w-3 h-3 text-[#ac7f5e]" />
                          : <ChevronRight className="w-3 h-3 text-[#ac7f5e]" />
                        }
                      </button>
                      {buildUnitPropsOpen && (
                        <PropertiesPanel properties={buildUnitProperties} entityId={buildUnitId} hideAddButton label={buildUnitName} />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Tasks */}
              <TasksRightPanel
                tasks={tasks}
                onTaskClick={handleTaskClick}
                isUnread={isTaskUnread}
              />

              {/* Members */}
              <div>
                <p className="text-xs font-semibold text-[#ac7f5e] uppercase tracking-wider mb-3">Members</p>
                {channelMembers.length === 0 ? (
                  <p className="text-xs text-[#717182]">No members yet.</p>
                ) : (
                  <div className="space-y-2">
                    {channelMembers.map((u) => (
                      <div key={u.id}>
                        {confirmRemoveId === u.id ? (
                          <div className="text-xs bg-red-50 border border-red-200 rounded p-2">
                            <p className="text-red-700 mb-2">Remove <strong>{u.name || u.email}</strong>?</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleRemoveMember(u.id, u.name || u.email || u.id)}
                                className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                              >Confirm</button>
                              <button
                                onClick={() => setConfirmRemoveId(null)}
                                className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50"
                              >Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between group">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#e5d4c1] flex items-center justify-center text-[#976623] text-xs font-medium flex-shrink-0">
                                {((u.name || u.email || "?")[0] ?? "?").toUpperCase()}
                              </div>
                              <span className="text-sm text-[#1e1e1e] truncate">{u.name || u.email}</span>
                            </div>
                            {isOwner && u.id !== channelOwnerId && (
                              <button
                                onClick={() => setConfirmRemoveId(u.id)}
                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs transition-opacity"
                                title="Remove member"
                              >✕</button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>

      {/* Add Task modal */}
      {taskFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setTaskFormOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <button
              onClick={() => { setTaskFormOpen(false); setTaskName(""); setTaskDesc(""); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Add Task</h2>
            <form onSubmit={onAddTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Task Name</label>
                <input
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="Enter task name"
                  required
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#976623] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Enter a short description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#976623] focus:border-transparent resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingTask || !taskName.trim()}
                className="w-full bg-[#976623] hover:bg-[#7d5419] disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {isSubmittingTask ? "Adding…" : "Add Task"}
              </button>
            </form>
          </div>
        </div>
      )}

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
