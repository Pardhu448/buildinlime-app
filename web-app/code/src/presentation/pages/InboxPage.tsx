import { ArrowLeft, MessageSquare, ChevronRight } from "lucide-react";
import { Sidebar } from "../components/buildInlime";
import { unwrapJsonb } from "%/presentation/lib/utils";
import { useInboxPage } from "../hooks/use-inbox-page";

export function InboxPage() {
  const {
    currentUserId,
    mentionedMessages,
    getUserName,
    getChannel,
    getBuildUnit,
    getProject,
    formatTime,
    handleMessageClick,
  } = useInboxPage();

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
