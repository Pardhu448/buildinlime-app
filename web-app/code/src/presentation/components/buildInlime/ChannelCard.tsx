import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface ChannelCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  to?: string;
  onClick?: () => void;
}

export function ChannelCard({
  icon: Icon,
  title,
  description,
  to,
  onClick,
}: ChannelCardProps) {
  const content = (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded bg-[#f0e5d8] border border-[#e5d4c1] flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#976623]" />
        </div>
        <h3 className="font-semibold text-[#1e1e1e]">{title}</h3>
      </div>
      <p className="text-sm text-[#717182]">{description}</p>
    </>
  );

  if (to) {
    return (
      <Link
        href={to}
        className="bg-[#fdf8f2] border border-[#e5d4c1] rounded-lg p-4 hover:bg-[#f0e5d8] transition-colors cursor-pointer block"
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      onClick={onClick}
      className="bg-[#fdf8f2] border border-[#e5d4c1] rounded-lg p-4 hover:bg-[#f0e5d8] transition-colors cursor-pointer"
    >
      {content}
    </div>
  );
}
