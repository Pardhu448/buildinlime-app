import { Inbox } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function InboxNav() {
  return (
    <Link
      to="/inbox"
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors"
    >
      <Inbox className="w-4 h-4" />
      <span>Inbox</span>
    </Link>
  );
}
