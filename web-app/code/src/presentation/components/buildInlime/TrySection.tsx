import { Download, Plus } from "lucide-react";

export function TrySection() {
  return (
    <div className="mb-4">
      <p className="px-2 py-1 text-xs font-medium text-[#717182] mb-1">
        Try
      </p>
      <div className="space-y-1">
        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors">
          <Download className="w-4 h-4" />
          <span>Import issues</span>
        </button>
        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors">
          <Plus className="w-4 h-4" />
          <span>Invite people</span>
        </button>
      </div>
    </div>
  );
}
