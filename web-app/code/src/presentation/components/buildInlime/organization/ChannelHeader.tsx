import type { LucideIcon } from "lucide-react";

export interface ChannelHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function ChannelHeader({ icon: Icon, title, description }: ChannelHeaderProps) {
  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <Icon className="w-6 h-6 text-primary" />
        <h1 className="text-3xl font-bold text-foreground">
          {title}
        </h1>
      </div>
      <p className="text-muted-foreground mb-8">
        {description}
      </p>
    </>
  );
}
