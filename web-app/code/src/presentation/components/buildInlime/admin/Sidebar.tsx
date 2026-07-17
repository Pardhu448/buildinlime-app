import { useState } from "react";
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
import { createTeamAction, updateTeamAction } from "%/application/actions/teams";
import { UserInfo } from "./UserInfo";
import { InboxNav } from "./InboxNav";
import { MyTasksNav } from "./MyTasksNav";
import { WorkspaceNav } from "./WorkspaceNav";
import { BuildUnitsNav } from "./BuildUnitsNav";
import { TeamsNav } from "./TeamsNav";
import { CreateTeamModal } from "./CreateTeamModal";
import { BottomSection } from "../BottomSection";

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
  const isProjectOwner = !!currentUserId && currentProject?.[0]?.owner_id === currentUserId;

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

  const handleAddMember = async (teamId: string, newMemberIds: string[]) => {
    const team = teamsCollection.get(teamId);
    if (!team) return;
    updateTeamAction({
      id: teamId,
      patch: { member_ids: [...team.member_ids, ...newMemberIds] },
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !currentUserId || !projectId) return;
    setIsSubmitting(true);
    const memberIds = selectedMemberIds.includes(currentUserId)
      ? selectedMemberIds
      : [currentUserId, ...selectedMemberIds];
    try {
      createTeamAction({
        name: teamName.trim(),
        description: teamDesc.trim() || null,
        owner_id: currentUserId,
        project_id: projectId,
        member_ids: memberIds,
      });
      setCreateOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <aside className="w-60 bg-card-surface border-r border-card-border flex flex-col">
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
              className="flex items-center gap-2 px-3 py-2 mb-2 rounded hover:bg-icon-chip transition-colors group"
            >
              <div className="w-5 h-5 rounded bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{projectName[0]?.toUpperCase()}</span>
              </div>
              <span className="text-sm font-semibold text-foreground truncate">{projectName}</span>
            </Link>
          )}

          {/* Workspace section — always visible */}
          <WorkspaceNav
            expanded={expandedWorkspace}
            onToggle={() => setExpandedWorkspace(!expandedWorkspace)}
            projects={userProjects}
          />

          {/* Build Units — only when inside a project */}
          {projectId && (
            <BuildUnitsNav
              projectId={projectId}
              expanded={expandedBuildUnits}
              onToggle={() => setExpandedBuildUnits(!expandedBuildUnits)}
              buildUnits={projectBuildUnits ?? []}
              channelsFor={getChannelsForBuildUnit}
              expandedBuIds={expandedBuIds}
              onToggleBu={toggleBu}
            />
          )}

          {/* Teams — only when inside a project and user is the project owner */}
          {projectId && isProjectOwner && (
            <TeamsNav
              expanded={expandedTeams}
              onToggle={() => setExpandedTeams(!expandedTeams)}
              onCreate={openCreate}
              teams={allTeams ?? []}
              allUsers={allUsers ?? []}
              onAddMember={handleAddMember}
            />
          )}
        </nav>

        <BottomSection />
      </aside>

      <CreateTeamModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        teamName={teamName}
        setTeamName={setTeamName}
        teamDesc={teamDesc}
        setTeamDesc={setTeamDesc}
        users={allUsers ?? []}
        currentUserId={currentUserId}
        selectedMemberIds={selectedMemberIds}
        toggleMember={toggleMember}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
