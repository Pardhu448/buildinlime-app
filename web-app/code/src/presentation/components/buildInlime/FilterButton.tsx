import { SlidersHorizontal } from "lucide-react";
import { ToolbarButton } from "./ToolbarButton";

interface FilterButtonProps {
  onClick?: () => void;
  active?: boolean;
}

export function FilterButton({ onClick, active }: FilterButtonProps) {
  return <ToolbarButton icon={SlidersHorizontal} label="Filter" onClick={onClick} active={active} />;
}
