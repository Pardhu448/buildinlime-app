import { useState } from "react";
import { 
  Search, 
  Plus, 
  Inbox, 
  ListTodo, 
  FolderKanban, 
  ChevronDown, 
  ChevronRight,
  Filter,
  Settings,
  MoreHorizontal,
  Download,
  Star,
  LogOut,
  RefreshCw,
  Package,
  SlidersHorizontal,
  Layers,
  PanelRight
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  health: "on-track" | "at-risk" | "off-track";
  priority: "low" | "medium" | "high";
  lead: string;
  targetDate: string;
  progress: number;
}

const mockProjects: Project[] = [
  {
    id: "2",
    name: "Foundation Work",
    health: "on-track",
    priority: "high",
    lead: "Sarah Johnson",
    targetDate: "Mar 15, 2026",
    progress: 65,
  },
  {
    id: "3",
    name: "Structural Engineering",
    health: "at-risk",
    priority: "medium",
    lead: "Mike Chen",
    targetDate: "Apr 30, 2026",
    progress: 42,
  },
  {
    id: "4",
    name: "Interior Design",
    health: "on-track",
    priority: "low",
    lead: "Emma Davis",
    targetDate: "Jun 20, 2026",
    progress: 28,
  },
];

export function ProjectsPage() {
  const [expandedWorkspace, setExpandedWorkspace] = useState(true);
  const [expandedTeam, setExpandedTeam] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [expandedMasonaryTeam, setExpandedMasonaryTeam] = useState(true);

  const getHealthColor = (health: Project["health"]) => {
    switch (health) {
      case "on-track":
        return "text-green-600";
      case "at-risk":
        return "text-yellow-600";
      case "off-track":
        return "text-red-600";
    }
  };

  const getHealthLabel = (health: Project["health"]) => {
    switch (health) {
      case "on-track":
        return "On track";
      case "at-risk":
        return "At risk";
      case "off-track":
        return "Off track";
    }
  };

  const getPriorityColor = (priority: Project["priority"]) => {
    switch (priority) {
      case "high":
        return "text-[#976623]";
      case "medium":
        return "text-[#ac7f5e]";
      case "low":
        return "text-gray-500";
    }
  };

  const getPriorityLabel = (priority: Project["priority"]) => {
    switch (priority) {
      case "high":
        return "High";
      case "medium":
        return "Mid";
      case "low":
        return "Low";
    }
  };

  return (
    <div className="flex h-screen bg-white font-['Instrument_Sans',sans-serif]">
      {/* Sidebar */}
      <aside className="w-60 bg-[#fdf8f2] border-r border-[#e5d4c1] flex flex-col">
        {/* User info */}
        <div className="p-4 border-b border-[#e5d4c1] relative">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 flex-1 hover:bg-[#f0e5d8] rounded p-1 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#976623] flex items-center justify-center text-white font-bold text-sm">
                PE
              </div>
              <span className="font-medium text-[#1e1e1e]">ParthaE</span>
              <ChevronDown className="w-4 h-4 ml-auto text-[#717182]" />
            </button>
            <button className="p-2 hover:bg-[#f0e5d8] rounded transition-colors">
              <Search className="w-4 h-4 text-[#717182]" />
            </button>
            <button className="p-2 hover:bg-[#f0e5d8] rounded transition-colors">
              <Plus className="w-4 h-4 text-[#717182]" />
            </button>
          </div>
          
          {userMenuOpen && (
            <div className="absolute left-4 right-4 top-14 bg-white border border-gray-200 shadow-lg rounded-lg z-50 overflow-hidden">
              <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#1e1e1e] hover:bg-gray-50 transition-colors text-left">
                <Settings className="w-4 h-4 text-[#717182]" />
                <span>Settings</span>
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#1e1e1e] hover:bg-gray-50 transition-colors text-left">
                <RefreshCw className="w-4 h-4 text-[#717182]" />
                <span>Switch Project</span>
              </button>
              <div className="border-t border-gray-200" />
              <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left">
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1 mb-6">
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors">
              <Inbox className="w-4 h-4" />
              <span>Inbox</span>
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors">
              <ListTodo className="w-4 h-4" />
              <span>My Tasks</span>
            </button>
          </div>

          {/* ProjectSpace */}
          <div className="mb-4">
            <button
              onClick={() => setExpandedWorkspace(!expandedWorkspace)}
              className="w-full flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#717182] hover:text-[#1e1e1e] transition-colors mb-1"
            >
              {expandedWorkspace ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span>ProjectSpace</span>
            </button>
            {expandedWorkspace && (
              <div className="space-y-1">
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1e1e1e] bg-[#f0e5d8] rounded transition-colors">
                  <Package className="w-4 h-4" />
                  <span>BuildUnits</span>
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors">
                  <Layers className="w-4 h-4" />
                  <span>Views</span>
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                  <span>More</span>
                </button>
              </div>
            )}
          </div>

          {/* Your teams */}
          <div className="mb-4">
            <button
              onClick={() => setExpandedTeam(!expandedTeam)}
              className="w-full flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#717182] hover:text-[#1e1e1e] transition-colors mb-1"
            >
              {expandedTeam ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span>Your teams</span>
            </button>
            {expandedTeam && (
              <div className="space-y-1">
                <div className="mb-2">
                  <div className="group flex items-center gap-2 px-3 py-1.5 hover:bg-[#f0e5d8] rounded transition-colors">
                    <button
                      onClick={() => setExpandedMasonaryTeam(!expandedMasonaryTeam)}
                      className="flex items-center gap-2 flex-1"
                    >
                      <div className="w-4 h-4 rounded bg-[#976623] flex items-center justify-center text-white text-[10px] font-bold">
                        M
                      </div>
                      <span className="text-sm font-medium text-[#1e1e1e]">MasonaryTeam</span>
                      {expandedMasonaryTeam ? (
                        <ChevronDown className="w-3 h-3 text-[#717182]" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-[#717182]" />
                      )}
                    </button>
                    <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#e5d4c1] rounded transition-opacity">
                      <MoreHorizontal className="w-3.5 h-3.5 text-[#717182]" />
                    </button>
                  </div>
                  {expandedMasonaryTeam && (
                    <div className="ml-6 space-y-1 mt-1">
                      <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors">
                        <ListTodo className="w-3.5 h-3.5" />
                        <span className="text-xs">Tasks</span>
                      </button>
                      <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors">
                        <Package className="w-3.5 h-3.5" />
                        <span className="text-xs">BuildUnits</span>
                      </button>
                      <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors">
                        <Layers className="w-3.5 h-3.5" />
                        <span className="text-xs">Views</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Try section */}
          <div className="border-t border-[#e5d4c1] pt-3 mt-3">
            <div className="px-2 py-1 mb-1">
              <span className="text-xs font-medium text-[#717182]">Try</span>
            </div>
            <div className="space-y-1">
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors">
                <Download className="w-4 h-4" />
                <span>Import issues</span>
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors">
                <Plus className="w-4 h-4" />
                <span>Invite people</span>
              </button>
            </div>
          </div>
        </nav>

        {/* What's new footer */}
        <div className="p-3 border-t border-[#e5d4c1]">
          <button className="w-full px-3 py-2 text-xs text-[#717182] hover:text-[#1e1e1e] text-left transition-colors">
            <div className="font-medium">What's new</div>
            <div className="text-[11px] mt-0.5">Announce fillies and share issues</div>
            <div className="text-[11px]">in private teams</div>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-[#1e1e1e]">BuildUnits</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 bg-[#976623] text-white text-sm font-medium rounded-lg hover:bg-[#7d5419] transition-colors">
                <Plus className="w-4 h-4" />
                New BuildUnit
              </button>
              <button className="p-2 text-[#717182] hover:bg-gray-100 rounded transition-colors">
                <PanelRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button className="px-3 py-1.5 text-sm text-[#1e1e1e] hover:bg-gray-100 rounded transition-colors">
                All BuildUnits
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#717182] hover:bg-gray-100 rounded transition-colors">
                <Plus className="w-4 h-4" />
                New View
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#717182] hover:bg-gray-100 rounded transition-colors">
                <SlidersHorizontal className="w-4 h-4" />
                <span>Display</span>
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#717182] hover:bg-gray-100 rounded transition-colors">
                <Filter className="w-4 h-4" />
                <span>Filter</span>
              </button>
            </div>
          </div>
        </div>

        {/* Projects table */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full">
            <thead className="sticky top-0 bg-white border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-[#717182]">
                  Build Unit Name
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-[#717182]">
                  Health
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-[#717182]">
                  Priority
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-[#717182]">
                  Lead
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-[#717182]">
                  Target Date
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-[#717182]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mockProjects.map((project) => (
                <tr
                  key={project.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#976623]" />
                      <span className="text-sm font-medium text-[#1e1e1e]">
                        {project.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm ${getHealthColor(project.health)}`}>
                      {getHealthLabel(project.health)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm ${getPriorityColor(project.priority)}`}>
                      {getPriorityLabel(project.priority)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {project.lead ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#976623] flex items-center justify-center text-white text-xs font-medium">
                          {project.lead.split(" ").map(n => n[0]).join("")}
                        </div>
                        <span className="text-sm text-[#1e1e1e]">{project.lead}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-[#717182]">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {project.targetDate ? (
                      <span className="text-sm text-[#1e1e1e]">{project.targetDate}</span>
                    ) : (
                      <span className="text-sm text-[#717182]">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="relative w-8 h-8">
                        <svg className="w-8 h-8 transform -rotate-90">
                          <circle
                            cx="16"
                            cy="16"
                            r="14"
                            fill="none"
                            stroke="#e5d4c1"
                            strokeWidth="3"
                          />
                          <circle
                            cx="16"
                            cy="16"
                            r="14"
                            fill="none"
                            stroke="#976623"
                            strokeWidth="3"
                            strokeDasharray={`${2 * Math.PI * 14}`}
                            strokeDashoffset={`${2 * Math.PI * 14 * (1 - project.progress / 100)}`}
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                      <span className="text-sm text-[#1e1e1e]">{project.progress}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}