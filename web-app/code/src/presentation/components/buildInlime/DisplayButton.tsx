import { LayoutGrid } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ToolbarButton } from "./ToolbarButton";

interface DisplayButtonProps {
  onClick?: () => void;
  icon?: LucideIcon;
  label?: string;
}

export function DisplayButton({ onClick, icon = LayoutGrid, label = "Display" }: DisplayButtonProps) {
  return <ToolbarButton icon={icon} label={label} onClick={onClick} />;
}
