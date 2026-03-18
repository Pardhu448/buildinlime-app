import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronRight,
  ChevronDown,
  Link as LinkIcon,
  Bell,
  PanelRight,
  Hammer,
} from "lucide-react";
import {
  Sidebar,
  ChannelHeader,
  PropertiesInline,
  ResourcesSection,
  AssignedToSection,
} from "../components/buildInlime";
import { PropertiesPanel } from "../components/buildInlime/PropertiesPanel";
import type { Property } from "%/domain/communication/types";

interface TaskPageProps {
  projectId: string;
  projectName: string;
  buildUnitName: string;
  buildUnitId: string;
  channelName: string;
  channelId: string;
  taskId: string;
  taskName: string;
  taskDescription: string;
  properties: Property[];
  channelMemberIds: string[];
  currentAssigneeId: string | null;
  currentUserId: string;
}

export function TaskPage({
  projectId,
  projectName,
  buildUnitName,
  buildUnitId,
  channelName,
  channelId,
  taskId,
  taskName,
  taskDescription,
  properties,
  channelMemberIds,
  currentAssigneeId,
  currentUserId,
}: TaskPageProps) {
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [taskPropsOpen, setTaskPropsOpen] = useState(true);

  return (
    <div className="flex h-screen bg-white font-['Instrument_Sans',sans-serif]">
      {/* Sidebar */}
      <Sidebar projectId={projectId} />

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top navigation bar */}
        <header className="border-b border-gray-200 bg-white px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#717182] text-sm">
              <Link
                to="/projects/$projectId"
                params={{ projectId }}
                className="hover:text-[#1e1e1e] transition-colors"
              >
                {projectName}
              </Link>
              <ChevronRight className="w-4 h-4" />
              <Link
                href={`/projects/${projectId}/${buildUnitName}`}
                className="hover:text-[#1e1e1e] transition-colors"
              >
                {buildUnitName}
              </Link>
              <ChevronRight className="w-4 h-4" />
              <Link
                href={`/projects/${projectId}/${buildUnitName}/${channelName}`}
                className="hover:text-[#1e1e1e] transition-colors"
              >
                {channelName}
              </Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-[#1e1e1e]">{taskName}</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-1.5 text-[#717182] hover:bg-gray-100 rounded transition-colors">
                <LinkIcon className="w-4 h-4" />
              </button>
              <button className="p-1.5 text-[#717182] hover:bg-gray-100 rounded transition-colors">
                <Bell className="w-4 h-4" />
              </button>
              <button
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                className="p-1.5 text-[#717182] hover:bg-gray-100 rounded transition-colors"
              >
                <PanelRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Content area */}
          <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
            <ChannelHeader icon={Hammer} title={taskName} description={taskDescription} />

            {/* Properties inline */}
            <PropertiesInline properties={properties} buildUnitId={taskId} entity="task" />

            {/* Assigned To */}
            <AssignedToSection
              taskId={taskId}
              currentAssigneeId={currentAssigneeId}
              channelMemberIds={channelMemberIds}
            />

            {/* Resources */}
            <ResourcesSection
              channelId={channelId}
              taskId={taskId}
              buildunitId={buildUnitId}
              projectId={projectId}
              createdbyId={currentUserId}
              memberIds={channelMemberIds.length > 0 ? channelMemberIds : [currentUserId]}
            />
          </div>

          {/* Right panel */}
          {rightPanelOpen && (
            <aside className="w-72 bg-[#fdf8f2] border-l border-[#e5d4c1] overflow-y-auto p-6 space-y-8">
              {/* Properties */}
              <div>
                <button
                  onClick={() => setPropertiesOpen(!propertiesOpen)}
                  className="flex items-center justify-between w-full mb-4"
                >
                  <h3 className="text-sm font-medium text-[#717182]">Properties</h3>
                  {propertiesOpen
                    ? <ChevronDown className="w-4 h-4 text-[#717182]" />
                    : <ChevronRight className="w-4 h-4 text-[#717182]" />
                  }
                </button>
                {propertiesOpen && (
                  <div>
                    {/* Task sub-section */}
                    <button
                      onClick={() => setTaskPropsOpen(!taskPropsOpen)}
                      className="flex items-center justify-between w-full mb-3"
                    >
                      <p className="text-xs text-[#ac7f5e]">Task</p>
                      {taskPropsOpen
                        ? <ChevronDown className="w-3 h-3 text-[#ac7f5e]" />
                        : <ChevronRight className="w-3 h-3 text-[#ac7f5e]" />
                      }
                    </button>
                    {taskPropsOpen && (
                      <PropertiesPanel properties={properties} buildUnitId={taskId} hideLabel />
                    )}
                  </div>
                )}
              </div>

              {/* Details */}
              <div>
                <p className="text-xs font-semibold text-[#ac7f5e] uppercase tracking-wider mb-3">Details</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#717182]">Channel</span>
                    <span className="text-sm text-[#1e1e1e]">{channelName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#717182]">Build Unit</span>
                    <span className="text-sm text-[#1e1e1e]">{buildUnitName}</span>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
