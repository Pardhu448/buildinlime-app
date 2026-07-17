import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

interface NavButtonProps {
  icon: LucideIcon;
  label: string;
  /** When provided, renders as a router Link instead of a button. */
  to?: string;
  isActive?: boolean;
  /** py-2 (default) or py-1.5 (compact) */
  size?: "default" | "compact";
}

export function NavButton({ icon: Icon, label, to, isActive = false, size = "default" }: NavButtonProps) {
  const py = size === "compact" ? "py-1.5" : "py-2";
  const className = `w-full flex items-center gap-2 px-3 ${py} text-sm text-[#1e1e1e] ${
    isActive ? "bg-icon-chip" : "hover:bg-icon-chip"
  } rounded transition-colors`;

  if (to) {
    return (
      <Link to={to} className={className}>
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <button className={className}>
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}
