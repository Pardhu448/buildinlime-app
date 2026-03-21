import type { LucideIcon } from "lucide-react";
import { ChannelCard } from "./ChannelCard";
import { NewChannelButton } from "./NewChannelButton";
import type { PendingItem } from "%/presentation/hooks/use-pending-items";

export interface Channel {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  isPending?: boolean;
  to?: string;
  onClick?: () => void;
}

interface ChannelsSectionProps {
  channels: Channel[];
  buildUnitId: string;
  pendingIds: Set<string>;
  addPending: (item: PendingItem) => void;
  removePending: (id: string) => void;
  onTrpcComplete: (id: string) => void;
}

export function ChannelsSection({ channels, buildUnitId, pendingIds, addPending, removePending, onTrpcComplete }: ChannelsSectionProps) {
  return (
    <div className="border-t border-gray-200 pt-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#717182]">Channels</span>
        </div>
        <NewChannelButton
          buildUnitId={buildUnitId}
          addPending={addPending}
          removePending={removePending}
          onTrpcComplete={onTrpcComplete}
        />
      </div>

      {/* Channel Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {channels.map((channel) => (
          <ChannelCard
            key={channel.id}
            icon={channel.icon}
            title={channel.title}
            description={channel.description}
            to={channel.to}
            onClick={channel.onClick}
            isPending={pendingIds.has(channel.id)}
          />
        ))}
      </div>
    </div>
  );
}
