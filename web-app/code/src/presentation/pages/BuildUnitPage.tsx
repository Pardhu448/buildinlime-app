import { useState } from "react";
import { Link } from '@tanstack/react-router';
import { ChevronRight } from "lucide-react";
import {
  Sidebar,
  ProjectHeader,
  PropertiesInline,
  ChannelsSection,
  PropertiesPanel,
  PageTopBar,
} from "../components/buildInlime";
import type { Channel } from "../components/buildInlime";
import type { Property } from "%/domain/communication/types";
import type { PendingItem } from "%/presentation/hooks/use-pending-items";



export function BuildUnitPage({ projectId, buildUnitName, buildUnitId, projectName, buildUnitDesc, channels, properties: dbProperties, pendingChannelIds, addPendingChannel, removePendingChannel, onChannelTrpcComplete }: { projectId: string; buildUnitName: string; buildUnitId: string; projectName: string; buildUnitDesc: string; channels?: Channel[]; properties?: Property[]; pendingChannelIds: Set<string>; addPendingChannel: (item: PendingItem) => void; removePendingChannel: (id: string) => void; onChannelTrpcComplete: (id: string) => void }) {
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  return (
    <div className="flex h-screen bg-white font-['Instrument_Sans',sans-serif]">
      {/* Sidebar */}
      <Sidebar projectId={projectId} />

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <PageTopBar
          onToggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)}
          breadcrumbs={
            <>
              <Link
                to="/projects/$projectId"
                params={{ projectId }}
                className="hover:text-[#1e1e1e] transition-colors"
              >
                {projectName}
              </Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-[#1e1e1e]">{buildUnitName}</span>
            </>
          }
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Content area */}
          <div className="flex-1 overflow-y-auto bg-white">
            {/* Project header */}
            <div className="px-8 py-8">
              <ProjectHeader
                title={buildUnitName}
                description={buildUnitDesc}
              />

              {/* Properties inline */}
              {<PropertiesInline properties={dbProperties ?? []} buildUnitId={buildUnitId} />}

              {/* Resources */}
              {/* <ResourceDisplay
                channelId={null}
                buildunitId={buildUnitId}
              /> */}

              {/* Channels */}
              <ChannelsSection
                channels={channels ?? []}
                buildUnitId={buildUnitId}
                pendingIds={pendingChannelIds}
                addPending={addPendingChannel}
                removePending={removePendingChannel}
                onTrpcComplete={onChannelTrpcComplete}
              />
            </div>
          </div>

          {/* Right panel */}
          {rightPanelOpen && (
            <aside className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
              <div className="p-6 space-y-6">
                
                {/* Properties */}
                <PropertiesPanel
                  properties={dbProperties ?? []}
                  buildUnitId={buildUnitId}
                />

                {/* Activity */}
                {/* <ActivityPanel
                  activities={activities}
                  onSeeAll={() => console.log("See all clicked")}
                /> */}
              </div>
            </aside>
          )}
          
        </div>
      </main>
    </div>
  );
}
