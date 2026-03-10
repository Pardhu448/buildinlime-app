import { ArrowLeft, MessageSquare, ChevronRight } from "lucide-react";
import { useLiveQuery } from "@tanstack/react-db";
import { useNavigate } from "@tanstack/react-router";
import { useSession } from "%/infrastructure/auth/client";
import {
  messagesCollection,
  usersCollection,
  channelsCollection,
  buildUnitsCollection,
  projectsCollection,
} from "%/infrastructure/database/tanstack-db-electric/admincollections";
import { Sidebar } from "../components/buildInlime";
import { unwrapJsonb, parseTextArray } from "%/presentation/lib/utils";

export function InboxPage() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const currentUserId = session?.user?.id ?? "";

  const { data: allMessages } = useLiveQuery((q) => q.from({ messagesCollection }), []);
  const { data: allUsers } = useLiveQuery((q) => q.from({ usersCollection }), []);
  const { data: allChannels } = useLiveQuery((q) => q.from({ channelsCollection }), []);
  const { data: allBuildUnits } = useLiveQuery((q) => q.from({ buildUnitsCollection }), []);
  const { data: allProjects } = useLiveQuery((q) => q.from({ projectsCollection }), []);

  const mentionedMessages = (allMessages ?? [])
    .filter((m) => parseTextArray(m.mention_ids).includes(currentUserId))
    .sort((a, b) => {
      const aTime = a.created_at instanceof Date ? a.created_at.getTime() : new Date(a.created_at as string).getTime();
      const bTime = b.created_at instanceof Date ? b.created_at.getTime() : new Date(b.created_at as string).getTime();
      return bTime - aTime;
    });

  const getUserName = (userId: string) => {
    const user = (allUsers ?? []).find((u) => u.id === userId);
    return user?.name || user?.email || "Unknown";
  };

  const getChannel = (channelId: string) => (allChannels ?? []).find((c) => c.id === channelId);
  const getBuildUnit = (buildunitId: string) => (allBuildUnits ?? []).find((b) => b.id === buildunitId);
  const getProject = (projectId: string) => (allProjects ?? []).find((p) => p.id === projectId);

  const handleMessageClick = (msg: NonNullable<typeof allMessages>[number]) => {
    const buildUnit = getBuildUnit(msg.buildunit_id);
    const channel = getChannel(msg.channel_id);
    if (!buildUnit || !channel) return;
    navigate({
      to: "/projects/$projectId/$buildUnitName/$channelName/",
      params: {
        projectId: msg.project_id,
        buildUnitName: buildUnit.name,
        channelName: unwrapJsonb(channel.name),
      },
    });
  };

  const formatTime = (val: unknown) => {
    const date = val instanceof Date ? val : new Date(val as string);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex h-screen bg-white font-['Instrument_Sans',sans-serif]">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top nav */}
        <header className="h-12 bg-white border-b border-[#e5d4c1] flex items-center gap-3 px-6">
          <button
            onClick={() => window.history.back()}
            className="p-1 text-[#717182] hover:text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-semibold text-[16px] text-[#1e1e1e]">Inbox</h1>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {!currentUserId ? (
            <p className="text-sm text-[#717182]">Loading…</p>
          ) : mentionedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <MessageSquare className="w-10 h-10 text-[#e5d4c1] mb-3" />
              <p className="text-sm font-medium text-[#717182]">No mentions yet</p>
              <p className="text-xs text-[#717182] mt-1">Messages where you're mentioned will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2 max-w-2xl">
              {mentionedMessages.map((msg) => {
                const senderName = getUserName(msg.createdby_id);
                const initial = (senderName[0] ?? "?").toUpperCase();
                const channel = getChannel(msg.channel_id);
                const buildUnit = getBuildUnit(msg.buildunit_id);
                const project = getProject(msg.project_id);
                const channelName = channel ? unwrapJsonb(channel.name) : null;

                return (
                  <button
                    key={msg.id}
                    onClick={() => handleMessageClick(msg)}
                    className="w-full flex items-start gap-3 px-4 py-3 bg-[#fdf8f2] border border-[#e5d4c1] rounded-lg hover:border-[#ac7f5e] hover:bg-[#f5ece0] transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#e5d4c1] flex items-center justify-center text-[#976623] text-xs font-semibold flex-shrink-0 mt-0.5">
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium text-[#1e1e1e]">{senderName}</span>
                        <span className="text-xs text-[#717182] whitespace-nowrap">{formatTime(msg.created_at)}</span>
                      </div>
                      <p className="text-sm text-[#1e1e1e] break-words">{msg.text}</p>
                      {/* Breadcrumb: Project > Build Unit > Channel */}
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {project && (
                          <>
                            <span className="text-xs text-[#ac7f5e]">{project.name}</span>
                            <ChevronRight className="w-3 h-3 text-[#ac7f5e]" />
                          </>
                        )}
                        {buildUnit && (
                          <>
                            <span className="text-xs text-[#ac7f5e]">{buildUnit.name}</span>
                            <ChevronRight className="w-3 h-3 text-[#ac7f5e]" />
                          </>
                        )}
                        {channelName && (
                          <span className="text-xs text-[#ac7f5e]">#{channelName}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
