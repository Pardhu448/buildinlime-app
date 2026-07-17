import { useEffect } from "react";
import { ArrowLeft, MessageSquare, ChevronRight } from "lucide-react";
import { Sidebar } from "../components/buildInlime";
import { unwrapJsonb } from "%/presentation/lib/utils";
import { useInboxPage } from "../hooks/use-inbox-page";
import { useSeen } from "../hooks/use-seen";

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

  // Seen mentions stay in the list, de-emphasised. The Inbox is a record of what
  // needed you, not a queue to drain — a mention you have seen is still
  // something you may need to find again. Opening the Inbox marks everything in
  // it seen (on leave), so the badge clears without visiting each channel.
  const { isMessageUnseen, markInboxSeen } = useSeen();

  useEffect(() => {
    // Mark on LEAVE: the unread emphasis stays visible while you are looking,
    // then the timestamp advances on unmount so the badge clears.
    return () => markInboxSeen();
  }, [markInboxSeen]);

  return (
    <div className="flex h-screen bg-white font-['Instrument_Sans',sans-serif]">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top nav */}
        <header className="h-12 bg-white border-b border-card-border flex items-center gap-3 px-6">
          <button
            onClick={() => window.history.back()}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-icon-chip rounded transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-semibold text-[16px] text-foreground">Inbox</h1>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {!currentUserId ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : mentionedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <MessageSquare className="w-10 h-10 text-card-border mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No mentions yet</p>
              <p className="text-xs text-muted-foreground mt-1">Messages where you're mentioned will appear here.</p>
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

                const unread = isMessageUnseen(msg.created_at);

                return (
                  <button
                    key={msg.id}
                    onClick={() => handleMessageClick(msg)}
                    className={`w-full flex items-start gap-3 px-4 py-3 border rounded-lg hover:border-border hover:bg-[#f5ece0] transition-colors text-left ${
                      unread
                        ? "bg-[#f5ece0] border-border"
                        : "bg-card-surface border-card-border"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-card-border flex items-center justify-center text-primary text-xs font-semibold flex-shrink-0 mt-0.5">
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="flex items-center gap-1.5 min-w-0">
                          {/* Unread marker — only on unread rows, so it means something. */}
                          {unread && (
                            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                          <span className={`text-sm truncate ${unread ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
                            {senderName}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTime(msg.created_at)}</span>
                      </div>
                      <p className={`text-sm break-words ${unread ? "text-foreground" : "text-muted-foreground"}`}>
                        {msg.text}
                      </p>
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {project && (
                          <>
                            <span className="text-xs text-secondary">{project.name}</span>
                            <ChevronRight className="w-3 h-3 text-secondary" />
                          </>
                        )}
                        {buildUnit && (
                          <>
                            <span className="text-xs text-secondary">{buildUnit.name}</span>
                            <ChevronRight className="w-3 h-3 text-secondary" />
                          </>
                        )}
                        {channelName && (
                          <span className="text-xs text-secondary">#{channelName}</span>
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
