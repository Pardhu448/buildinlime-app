import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

interface TeamSectionProps {
  teamId: string;
  name: string;
  description?: string | null;
  members: TeamMember[];
  currentMemberIds: string[];
  allUsers: { id: string; name: string | null; email: string }[];
  onAddMember: (teamId: string, newMemberIds: string[]) => Promise<void>;
}

export function TeamSection({ teamId, name, description, members, currentMemberIds, allUsers, onAddMember }: TeamSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initial = (name[0] ?? "T").toUpperCase();
  const nonMembers = allUsers.filter(u => !currentMemberIds.includes(u.id));

  const toggleUser = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const openAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds([]);
    setAddOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIds.length) return;
    setIsSubmitting(true);
    try {
      await onAddMember(teamId, selectedIds);
      setAddOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="mb-1">
        <div className="group flex items-center gap-2 px-3 py-1.5 hover:bg-[#f0e5d8] rounded transition-colors">
          <div className="w-5 h-5 rounded bg-[#976623] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{initial}</span>
          </div>
          <span className="text-sm text-[#1e1e1e] font-medium truncate flex-1">{name}</span>
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
            <button
              onClick={openAdd}
              className="p-0.5 hover:text-[#976623] hover:bg-[#e5d4c1] rounded transition-colors"
              title="Add member"
            >
              <Plus className="w-3 h-3 text-[#717182]" />
            </button>
            <button onClick={() => setExpanded(!expanded)}>
              {expanded ? (
                <ChevronDown className="w-3 h-3 text-[#717182]" />
              ) : (
                <ChevronRight className="w-3 h-3 text-[#717182]" />
              )}
            </button>
          </div>
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

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <button
              onClick={() => setAddOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-semibold text-[#1e1e1e] mb-5">Add Members to {name}</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1e1e1e] mb-2">Members</label>
                {nonMembers.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-[#717182] border border-[#e5d4c1] rounded-md">
                    All users are already members of this team.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-[#e5d4c1] rounded-md divide-y divide-[#f0e5d8]">
                    {nonMembers.map((user) => {
                      const checked = selectedIds.includes(user.id);
                      return (
                        <label
                          key={user.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-[#fdf8f2] transition-colors cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleUser(user.id)}
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
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !selectedIds.length || nonMembers.length === 0}
                className="w-full bg-[#976623] hover:bg-[#7d5419] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {isSubmitting ? "Adding…" : "Add Members"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
