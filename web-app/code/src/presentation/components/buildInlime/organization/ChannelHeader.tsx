import type { LucideIcon } from "lucide-react";

interface ChannelHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function ChannelHeader({ icon: Icon, title, description }: ChannelHeaderProps) {
  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <Icon className="w-6 h-6 text-[#976623]" />
        <h1 className="text-3xl font-bold text-[#1e1e1e]">
          {title}
        </h1>
      </div>
      <p className="text-[#717182] mb-8">
        {description}
      </p>
    </>
  );
}
