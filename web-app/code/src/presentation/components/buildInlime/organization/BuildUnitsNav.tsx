import { Package } from "lucide-react";
import { NavButton } from "../NavButton";

export interface BuildUnitsNavProps {
  to?: string;
  isActive?: boolean;
}

export function BuildUnitsNav({ to = "/project2", isActive = false }: BuildUnitsNavProps) {
  return <NavButton icon={Package} label="BuildUnits" to={to} isActive={isActive} />;
}
