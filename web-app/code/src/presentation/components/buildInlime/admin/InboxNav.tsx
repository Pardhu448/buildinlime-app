import { Inbox } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useInboxBadge } from "%/presentation/hooks/use-inbox-badge";

export function InboxNav() {
  // Messages mentioning me that I have not read — read from the user-scoped
  // inbox-mentions slice, not the full messages collection.
  const { unreadMentionCount } = useInboxBadge();

  return (
    <Link
      to="/inbox"
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1e1e1e] hover:bg-icon-chip rounded transition-colors"
    >
      <Inbox className="w-4 h-4" />
      <span className={`flex-1 ${unreadMentionCount > 0 ? "font-semibold" : ""}`}>
        Inbox
      </span>
      {unreadMentionCount > 0 && (
        <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#976623] text-white text-[10px] font-semibold">
          {unreadMentionCount > 99 ? "99+" : unreadMentionCount}
        </span>
      )}
    </Link>
  );
}
