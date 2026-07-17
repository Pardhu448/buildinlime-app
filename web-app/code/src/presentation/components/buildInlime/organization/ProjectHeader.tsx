import { Boxes } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ProjectHeaderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

export function ProjectHeader({ title, description, icon: Icon = Boxes }: ProjectHeaderProps) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className="w-12 h-12 rounded bg-icon-chip border border-card-border flex items-center justify-center">
        <Icon className="w-6 h-6 text-[#976623]" />
      </div>
      <div className="flex-1">
        <h1 className="text-3xl font-bold text-[#1e1e1e] mb-2">
          {title}
        </h1>
        <p className="text-[#717182] text-sm">
          {description}
        </p>
      </div>
    </div>
  );
}
