import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, X, Hash, FolderOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useLiveQuery, eq } from "@tanstack/react-db";
import { useSession } from "%/infrastructure/auth/client";
import {
  teamsCollection,
  usersCollection,
  buildUnitsCollection,
  channelsCollection,
  projectsCollection,
} from "%/infrastructure/database/tanstack-db-electric/admincollections";
import { unwrapJsonb } from "%/presentation/lib/utils";
import { UserInfo } from "./UserInfo";
import { InboxNav } from "./InboxNav";
import { MyTasksNav } from "./MyTasksNav";
import { TeamSection } from "./TeamSection";
import { BottomSection } from "./BottomSection";

export interface SidebarProps {
  projectId?: string;
}

export function Sidebar({ projectId }: SidebarProps) {
  const [expandedBuildUnits, setExpandedBuildUnits] = useState(true);
  const [expandedBuIds, setExpandedBuIds] = useState<Record<string, boolean>>({});
  const [expandedTeams, setExpandedTeams] = useState(true);
  const [expandedWorkspace, setExpandedWorkspace] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  // Form state
  const [teamName, setTeamName] = useState("");
  const [teamDesc, setTeamDesc] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? "";

  const { data: allTeams } = useLiveQuery((q) => q.from({ teamsCollection }), []);
  const { data: allUsers } = useLiveQuery((q) => q.from({ usersCollection }), []);
  const { data: allProjects } = useLiveQuery((q) => q.from({ projectsCollection }), []);

  // projectsCollection already returns only the current user's accessible projects
  const userProjects = allProjects ?? [];

  const { data: projectBuildUnits } = useLiveQuery(
    (q) =>
      projectId
        ? q.from({ buildUnitsCollection }).where(({ buildUnitsCollection: bu }) => eq(bu.project_id, projectId))
        : q.from({ buildUnitsCollection }).where(({ buildUnitsCollection: bu }) => eq(bu.project_id, "__none__")),
    [projectId]
  );

  const { data: allChannels } = useLiveQuery((q) => q.from({ channelsCollection }), []);

  const { data: currentProject } = useLiveQuery(
    (q) =>
      projectId
        ? q.from({ projectsCollection }).where(({ projectsCollection: p }) => eq(p.id, projectId))
        : q.from({ projectsCollection }).where(({ projectsCollection: p }) => eq(p.id, "__none__")),
    [projectId]
  );
  const projectName = currentProject?.[0]?.name ?? "";

  const getChannelsForBuildUnit = (buildUnitId: string) =>
    (allChannels ?? []).filter((c) => c.buildunit_id === buildUnitId);

  const toggleBu = (buId: string) =>
    setExpandedBuIds((prev) => ({ ...prev, [buId]: !prev[buId] }));

  const toggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const openCreate = () => {
    setTeamName("");
    setTeamDesc("");
    setSelectedMemberIds(currentUserId ? [currentUserId] : []);
    setCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !currentUserId) return;
    setIsSubmitting(true);
    const memberIds = selectedMemberIds.includes(currentUserId)
      ? selectedMemberIds
      : [currentUserId, ...selectedMemberIds];
    try {
      await teamsCollection.insert({
        id: crypto.randomUUID(),
        name: teamName.trim(),
        description: teamDesc.trim() || null,
        created_at: new Date(),
      });
      setCreateOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <aside className="w-60 bg-[#fdf8f2] border-r border-[#e5d4c1] flex flex-col">
        <UserInfo
          name={session?.user?.name || session?.user?.email || ""}
          initials={
            (session?.user?.name || session?.user?.email || "?")
              .split(" ")
              .filter(Boolean)
              .map((w) => w[0]?.toUpperCase() ?? "")
              .slice(0, 2)
              .join("")
          }
        />

        <nav className="flex-1 overflow-y-auto p-3">
          {/* Inbox + My Tasks — always visible */}
          <div className="space-y-1 mb-6">
            <InboxNav />
            <MyTasksNav />
          </div>

          {/* Project name — only when inside a project */}
          {projectId && projectName && (
            <Link
              to="/projects/$projectId"
              params={{ projectId }}
              className="flex items-center gap-2 px-3 py-2 mb-2 rounded hover:bg-[#f0e5d8] transition-colors group"
            >
              <div className="w-5 h-5 rounded bg-[#976623] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{projectName[0]?.toUpperCase()}</span>
              </div>
              <span className="text-sm font-semibold text-[#1e1e1e] truncate">{projectName}</span>
            </Link>
          )}

          {/* Workspace section — always visible */}
          <div className="mb-4">
            <button
              onClick={() => setExpandedWorkspace(!expandedWorkspace)}
              className="w-full flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#717182] hover:text-[#1e1e1e] transition-colors mb-1"
            >
              {expandedWorkspace ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span>Workspace</span>
            </button>

            {expandedWorkspace && (
              <div className="space-y-0.5">
                {/* All Projects link */}
                <Link
                  to="/projects"
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors"
                >
                  <FolderOpen className="w-4 h-4 text-[#976623] flex-shrink-0" />
                  <span className="font-medium">All Projects</span>
                </Link>

                {/* Individual project links */}
                {userProjects.map((p) => (
                  <Link
                    key={p.id}
                    to="/projects/$projectId"
                    params={{ projectId: p.id }}
                    className="w-full flex items-center gap-2 pl-7 pr-3 py-1.5 text-sm text-[#717182] hover:text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors"
                  >
                    <div className="w-4 h-4 rounded bg-[#e5d4c1] flex items-center justify-center flex-shrink-0">
                      <span className="text-[#976623] text-[9px] font-bold leading-none">
                        {p.name[0]?.toUpperCase()}
                      </span>
                    </div>
                    <span className="truncate">{p.name}</span>
                  </Link>
                ))}

                {userProjects.length === 0 && (
                  <p className="px-3 py-1 text-xs text-[#717182]">No projects yet</p>
                )}
              </div>
            )}
          </div>

          {/* Build Units — only when inside a project */}
          {projectId && (
            <div className="mb-4">
              <button
                onClick={() => setExpandedBuildUnits(!expandedBuildUnits)}
                className="w-full flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#717182] hover:text-[#1e1e1e] transition-colors mb-1"
              >
                {expandedBuildUnits ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <span>Build Units</span>
              </button>

              {expandedBuildUnits && (
                <div className="space-y-0.5">
                  {(projectBuildUnits ?? []).length === 0 ? (
                    <p className="px-4 py-1 text-xs text-[#717182]">No build units</p>
                  ) : (
                    (projectBuildUnits ?? []).map((bu) => {
                      const buExpanded = expandedBuIds[bu.id] ?? false;
                      const channels = getChannelsForBuildUnit(bu.id);
                      return (
                        <div key={bu.id}>
                          {/* Build Unit row */}
                          <div className="group flex items-center gap-1 rounded hover:bg-[#f0e5d8] transition-colors">
                            <button
                              onClick={() => toggleBu(bu.id)}
                              className="p-1 flex-shrink-0 text-[#717182]"
                            >
                              {buExpanded ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                            </button>
                            <Link
                              to="/projects/$projectId/$buildUnitName"
                              params={{ projectId: projectId!, buildUnitName: bu.name }}
                              className="flex-1 py-1.5 pr-2 text-sm text-[#1e1e1e] truncate"
                            >
                              {bu.name}
                            </Link>
                          </div>

                          {/* Channels nested under build unit */}
                          {buExpanded && (
                            <div className="ml-5 space-y-0.5 mt-0.5">
                              {channels.length === 0 ? (
                                <p className="px-3 py-1 text-xs text-[#717182]">No channels</p>
                              ) : (
                                channels.map((ch) => {
                                  const channelName = unwrapJsonb(ch.name);
                                  return (
                                    <Link
                                      key={ch.id}
                                      to="/projects/$projectId/$buildUnitName/$channelName/"
                                      params={{ projectId: projectId!, buildUnitName: bu.name, channelName }}
                                      className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-[#717182] hover:text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors"
                                    >
                                      <Hash className="w-3 h-3 flex-shrink-0" />
                                      <span className="truncate">{channelName}</span>
                                    </Link>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* Teams — only when inside a project */}
          {projectId && <div className="mb-4">
            <div className="flex items-center gap-1 px-2 py-1 mb-1">
              <button
                onClick={() => setExpandedTeams(!expandedTeams)}
                className="flex items-center gap-1 text-xs font-medium text-[#717182] hover:text-[#1e1e1e] transition-colors flex-1"
              >
                {expandedTeams ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <span>Teams</span>
              </button>
              <button
                onClick={openCreate}
                className="p-0.5 text-[#717182] hover:text-[#976623] hover:bg-[#f0e5d8] rounded transition-colors"
                title="Create team"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {expandedTeams && (
              <div className="space-y-1">
                {(allTeams ?? []).length === 0 ? (
                  <p className="px-3 py-1 text-xs text-[#717182]">No teams yet</p>
                ) : (
                  (allTeams ?? []).map((team) => (
                    <TeamSection
                      key={team.id}
                      name={team.name}
                      description={team.description}
                      members={[]}
                    />
                  ))
                )}
              </div>
            )}
          </div>}
        </nav>

        <BottomSection />
      </aside>

      {/* Create Team modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCreateOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <button
              onClick={() => setCreateOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-semibold text-[#1e1e1e] mb-5">Create Team</h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1e1e1e] mb-1">
                  Team Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Masonry Team"
                  required
                  autoFocus
                  className="w-full px-3 py-2 border border-[#e5d4c1] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#976623] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1e1e1e] mb-1">Description</label>
                <textarea
                  value={teamDesc}
                  onChange={(e) => setTeamDesc(e.target.value)}
                  placeholder="What does this team work on?"
                  rows={2}
                  className="w-full px-3 py-2 border border-[#e5d4c1] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#976623] focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1e1e1e] mb-2">Members</label>
                <div className="max-h-48 overflow-y-auto border border-[#e5d4c1] rounded-md divide-y divide-[#f0e5d8]">
                  {(allUsers ?? []).map((user) => {
                    const isCreator = user.id === currentUserId;
                    const checked = selectedMemberIds.includes(user.id);
                    return (
                      <label
                        key={user.id}
                        className={`flex items-center gap-3 px-3 py-2 hover:bg-[#fdf8f2] transition-colors ${
                          isCreator ? "opacity-70 cursor-not-allowed" : "cursor-pointer"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isCreator}
                          onChange={() => toggleMember(user.id)}
                          className="accent-[#976623]"
                        />
                        <div className="w-6 h-6 rounded-full bg-[#e5d4c1] flex items-center justify-center text-[#976623] text-xs font-medium flex-shrink-0">
                          {((user.name || user.email || "?")[0] ?? "?").toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-[#1e1e1e] truncate">{user.name || user.email}</p>
                          {user.name && (
                            <p className="text-xs text-[#717182] truncate">{user.email}</p>
                          )}
                        </div>
                        {isCreator && (
                          <span className="text-xs text-[#ac7f5e]">you</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !teamName.trim()}
                className="w-full bg-[#976623] hover:bg-[#7d5419] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {isSubmitting ? "Creating…" : "Create Team"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
