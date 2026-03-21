import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

interface TeamSectionProps {
  name: string;
  description?: string | null;
  members: TeamMember[];
}

export function TeamSection({ name, description, members }: TeamSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const initial = (name[0] ?? "T").toUpperCase();

  return (
    <div className="mb-1">
      <div className="group flex items-center gap-2 px-3 py-1.5 hover:bg-[#f0e5d8] rounded transition-colors">
        <div className="w-5 h-5 rounded bg-[#976623] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold">{initial}</span>
        </div>
        <span className="text-sm text-[#1e1e1e] font-medium truncate flex-1">{name}</span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto opacity-0 group-hover:opacity-100 flex-shrink-0"
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-[#717182]" />
          ) : (
            <ChevronRight className="w-3 h-3 text-[#717182]" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="ml-7 mt-1 space-y-1">
          {description && (
            <p className="px-2 py-1 text-xs text-[#717182] italic">{description}</p>
          )}
          {members.length === 0 ? (
            <p className="px-2 py-1 text-xs text-[#717182]">No members</p>
          ) : (
            members.map((m) => (
              <div key={m.id} className="flex items-center gap-2 px-2 py-1">
                <div className="w-5 h-5 rounded-full bg-[#e5d4c1] flex items-center justify-center text-[#976623] text-xs font-medium flex-shrink-0">
                  {((m.name || m.email)[0] ?? "?").toUpperCase()}
                </div>
                <span className="text-xs text-[#1e1e1e] truncate">{m.name || m.email}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
