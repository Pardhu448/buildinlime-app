import type { LucideIcon } from "lucide-react";

interface ToolbarButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}

export function ToolbarButton({ icon: Icon, label, onClick }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#717182] hover:text-[#1e1e1e] hover:bg-gray-50 rounded transition-colors"
    >
      <Icon className="w-4 h-4" />
      <span
        className="font-['Instrument_Sans',sans-serif] text-[14px]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {label}
      </span>
    </button>
  );
}
