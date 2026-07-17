import { Plus, MoreHorizontal, Tag, Package } from "lucide-react";
import { Link } from "@tanstack/react-router";

export interface BuildUnitInfo {
  name: string;
  link: string;
}

export interface PropertiesRightPanelProps {
  buildUnit?: BuildUnitInfo;
  channel?: string;
  onSetPriority?: () => void;
  onAssign?: () => void;
  onAddLabel?: () => void;
}

export function PropertiesRightPanel({
  buildUnit,
  channel,
  onSetPriority,
  onAssign,
  onAddLabel,
}: PropertiesRightPanelProps) {
  return (
    <>
      {/* Set priority */}
      <button className="w-full text-left mb-6" onClick={onSetPriority}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <MoreHorizontal className="w-4 h-4" />
          <span>Set priority</span>
        </div>
      </button>

      {/* Assign */}
      <button className="w-full text-left mb-6" onClick={onAssign}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <Plus className="w-4 h-4" />
          <span>Assign</span>
        </div>
      </button>

      {/* Labels */}
      <div className="mb-6">
        <p className="text-xs text-[#ac7f5e] mb-2">Labels</p>
        <button className="w-full text-left" onClick={onAddLabel}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
            <Tag className="w-4 h-4" />
            <span>Add label</span>
          </div>
        </button>
      </div>

      {/* Channel */}
      {channel && (
        <div className="mb-6">
          <p className="text-xs text-[#ac7f5e] mb-2">Channel</p>
          <div className="text-sm text-foreground">{channel}</div>
        </div>
      )}

      {/* BuildUnit */}
      {buildUnit && (
        <div className="mb-6">
          <p className="text-xs text-[#ac7f5e] mb-2">BuildUnit</p>
          <Link
            to={buildUnit.link}
            className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
          >
            <Package className="w-4 h-4" />
            <span>{buildUnit.name}</span>
          </Link>
        </div>
      )}
    </>
  );
}
