import { useState } from "react";
import type { ReactNode } from "react";
import { Link as LinkIcon, Check, PanelRight } from "lucide-react";

interface PageTopBarProps {
  breadcrumbs: ReactNode;
  onToggleRightPanel: () => void;
}

export function PageTopBar({ breadcrumbs, onToggleRightPanel }: PageTopBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <header className="border-b border-gray-200 bg-white px-6 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#717182] text-sm">
          {breadcrumbs}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            title="Copy link"
            className={`p-1.5 rounded transition-colors ${copied ? "text-green-600 bg-green-50" : "text-[#717182] hover:bg-gray-100"}`}
          >
            {copied ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
          </button>
          {/*
            FUTURE WORK: the notifications bell is a non-functional placeholder,
            hidden until built. Intended behaviour (deferred — see two open
            questions below before building):
              1) Toggling the bell subscribes the current user to the build
                 unit; while enabled, its activities are relayed to their
                 "Updates" page (new page + sidebar entry below "My Tasks",
                 styled like Inbox / My Tasks).
              2) Tracked activities: new channel created, new property added.
              3) Each Update is tagged with the build unit's icon and name.
            Open questions: (a) does enabling show past activity or only new
            activity going forward? (b) does "new property added" include
            properties on the build unit's channels/tasks, or build-unit-level
            only? Likely stack: activities + build_unit_subscriptions synced
            tables, activity rows emitted in the channels.create /
            properties.create tRPC mutations.

            <button className="p-1.5 text-[#717182] hover:bg-gray-100 rounded transition-colors">
              <Bell className="w-4 h-4" />
            </button>
          */}
          <button
            onClick={onToggleRightPanel}
            className="p-1.5 text-[#717182] hover:bg-gray-100 rounded transition-colors"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
