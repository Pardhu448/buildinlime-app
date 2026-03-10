import { useState } from "react";
import { Link } from "react-router";
import {
  Search,
  Plus,
  Inbox,
  ListTodo,
  ChevronDown,
  ChevronRight,
  Settings,
  MoreHorizontal,
  Download,
  LogOut,
  RefreshCw,
  Package,
  Layers,
  Target,
  Calendar,
  Users,
  Tag,
  Circle,
  Link as LinkIcon,
  MessageSquare,
  Bell,
  PanelRight,
  IndianRupee,
  NotebookPen,
  Ruler,
  Truck,
  Hammer,
  ClipboardCheck,
} from "lucide-react";

export function ProjectDetailsPage() {
  const [expandedWorkspace, setExpandedWorkspace] =
    useState(true);
  const [expandedTeam, setExpandedTeam] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [expandedMasonaryTeam, setExpandedMasonaryTeam] =
    useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

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
              <span className="font-medium text-[#1e1e1e]">
                ParthaE
              </span>
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
              onClick={() =>
                setExpandedWorkspace(!expandedWorkspace)
              }
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
                      onClick={() =>
                        setExpandedMasonaryTeam(
                          !expandedMasonaryTeam,
                        )
                      }
                      className="flex items-center gap-2 flex-1"
                    >
                      <div className="w-4 h-4 rounded bg-[#976623] flex items-center justify-center text-white text-[10px] font-bold">
                        M
                      </div>
                      <span className="text-sm font-medium text-[#1e1e1e]">
                        MasonaryTeam
                      </span>
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
                        <span className="text-xs">
                          BuildUnits
                        </span>
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
              <span className="text-xs font-medium text-[#717182]">
                Try
              </span>
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
            <div className="text-[11px] mt-0.5">
              Announce fillies and share issues
            </div>
            <div className="text-[11px]">in private teams</div>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top navigation bar */}
        <header className="border-b border-gray-200 bg-white px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[#717182] text-sm">
                <span>Foundation Work</span>
                <span>/</span>
                <span className="text-[#1e1e1e]">
                  Foundation Work
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-1.5 text-[#717182] hover:bg-gray-100 rounded transition-colors">
                <LinkIcon className="w-4 h-4" />
              </button>
              <button className="p-1.5 text-[#717182] hover:bg-gray-100 rounded transition-colors">
                <Bell className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  setRightPanelOpen(!rightPanelOpen)
                }
                className="p-1.5 text-[#717182] hover:bg-gray-100 rounded transition-colors"
              >
                <PanelRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Content area */}
          <div className="flex-1 overflow-y-auto bg-white">
            {/* Tabs */}
            <div className="border-b border-gray-200 bg-white px-6">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "overview"
                      ? "border-[#976623] text-[#1e1e1e]"
                      : "border-transparent text-[#717182] hover:text-[#1e1e1e]"
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab("channels")}
                  className={`px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "channels"
                      ? "border-[#976623] text-[#1e1e1e]"
                      : "border-transparent text-[#717182] hover:text-[#1e1e1e]"
                  }`}
                >
                  Tasks
                </button>
                <button className="p-1.5 text-[#717182] hover:text-[#1e1e1e] transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Project header */}
            <div className="px-8 py-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded bg-[#f0e5d8] border border-[#e5d4c1] flex items-center justify-center">
                  <Package className="w-6 h-6 text-[#976623]" />
                </div>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-[#1e1e1e] mb-2">
                    Foundation Work
                  </h1>
                  <p className="text-[#717182] text-sm">
                    random rubble masonry with lime mortar
                  </p>
                </div>
              </div>

              {/* Properties inline */}
              <div className="flex items-center gap-4 mb-6 text-sm flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[#717182]">
                    Properties
                  </span>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 bg-[#f0e5d8] border border-[#e5d4c1] rounded">
                  <Circle
                    className="w-3 h-3 text-orange-500"
                    fill="currentColor"
                  />
                  <span className="text-[#1e1e1e]">
                    Backlog
                  </span>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 bg-[#f0e5d8] border border-[#e5d4c1] rounded">
                  <span className="text-[#717182]">
                    No priority
                  </span>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 bg-[#f0e5d8] border border-[#e5d4c1] rounded">
                  <Target className="w-3 h-3 text-green-500" />
                  <span className="text-[#1e1e1e]">
                    Target date
                  </span>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 bg-[#f0e5d8] border border-[#e5d4c1] rounded">
                  <Package className="w-3 h-3 text-[#976623]" />
                  <span className="text-[#1e1e1e]">
                    MasonaryTeam
                  </span>
                </div>
                <button className="p-1 text-[#717182] hover:text-[#1e1e1e] transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>

              {/* Resources */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm text-[#717182]">
                    Resources
                  </span>
                  <button className="p-1 text-[#717182] hover:text-[#1e1e1e] transition-colors">
                    <Plus className="w-3 h-3" />
                  </button>
                  <span className="text-sm text-[#717182]">
                    Add document or link...
                  </span>
                </div>
              </div>

              {/* Channels */}
              <div className="border-t border-gray-200 pt-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-[#717182]">
                      Channels
                    </span>
                  </div>
                  <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-[#976623] rounded hover:bg-[#7d5419] transition-colors">
                    <MessageSquare className="w-4 h-4" />
                    New Channel
                  </button>
                </div>
                
                {/* Channel Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Finance Card */}
                  <div className="bg-[#fdf8f2] border border-[#e5d4c1] rounded-lg p-4 hover:bg-[#f0e5d8] transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded bg-[#f0e5d8] border border-[#e5d4c1] flex items-center justify-center">
                        <IndianRupee className="w-5 h-5 text-[#976623]" />
                      </div>
                      <h3 className="font-semibold text-[#1e1e1e]">Finance</h3>
                    </div>
                    <p className="text-sm text-[#717182]">
                      Details of budget and expenditure
                    </p>
                  </div>

                  {/* Requirements Card */}
                  <Link
                    to="/requirements"
                    className="bg-[#fdf8f2] border border-[#e5d4c1] rounded-lg p-4 hover:bg-[#f0e5d8] transition-colors cursor-pointer block"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded bg-[#f0e5d8] border border-[#e5d4c1] flex items-center justify-center">
                        <NotebookPen className="w-5 h-5 text-[#976623]" />
                      </div>
                      <h3 className="font-semibold text-[#1e1e1e]">Requirements</h3>
                    </div>
                    <p className="text-sm text-[#717182]">
                      Notes on the requirements
                    </p>
                  </Link>

                  {/* Design Card */}
                  <div className="bg-[#fdf8f2] border border-[#e5d4c1] rounded-lg p-4 hover:bg-[#f0e5d8] transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded bg-[#f0e5d8] border border-[#e5d4c1] flex items-center justify-center">
                        <Ruler className="w-5 h-5 text-[#976623]" />
                      </div>
                      <h3 className="font-semibold text-[#1e1e1e]">Design</h3>
                    </div>
                    <p className="text-sm text-[#717182]">
                      Comprehensive design of the BuildUnit
                    </p>
                  </div>

                  {/* Materials Card */}
                  <div className="bg-[#fdf8f2] border border-[#e5d4c1] rounded-lg p-4 hover:bg-[#f0e5d8] transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded bg-[#f0e5d8] border border-[#e5d4c1] flex items-center justify-center">
                        <Truck className="w-5 h-5 text-[#976623]" />
                      </div>
                      <h3 className="font-semibold text-[#1e1e1e]">Materials</h3>
                    </div>
                    <p className="text-sm text-[#717182]">
                      Information on the inventory of the materials required
                    </p>
                  </div>

                  {/* Tools Card */}
                  <div className="bg-[#fdf8f2] border border-[#e5d4c1] rounded-lg p-4 hover:bg-[#f0e5d8] transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded bg-[#f0e5d8] border border-[#e5d4c1] flex items-center justify-center">
                        <Hammer className="w-5 h-5 text-[#976623]" />
                      </div>
                      <h3 className="font-semibold text-[#1e1e1e]">Tools</h3>
                    </div>
                    <p className="text-sm text-[#717182]">
                      Information of the Tools used
                    </p>
                  </div>

                  {/* Execution Card */}
                  <div className="bg-[#fdf8f2] border border-[#e5d4c1] rounded-lg p-4 hover:bg-[#f0e5d8] transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded bg-[#f0e5d8] border border-[#e5d4c1] flex items-center justify-center">
                        <ClipboardCheck className="w-5 h-5 text-[#976623]" />
                      </div>
                      <h3 className="font-semibold text-[#1e1e1e]">Execution</h3>
                    </div>
                    <p className="text-sm text-[#717182]">
                      Details of execution on the site
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel */}
          {rightPanelOpen && (
            <aside className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Properties */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-[#717182]">
                      Properties
                    </h3>
                    <button className="p-1 text-[#717182] hover:text-[#1e1e1e] transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#717182]">
                        Status
                      </span>
                      <div className="flex items-center gap-2 px-2 py-1 bg-[#f0e5d8] border border-[#e5d4c1] rounded">
                        <Circle
                          className="w-2 h-2 text-orange-500"
                          fill="currentColor"
                        />
                        <span className="text-[#1e1e1e] text-sm">
                          Backlog
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#717182]">
                        Priority
                      </span>
                      <span className="text-sm text-[#1e1e1e]">
                        No priority
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#717182]">
                        Members
                      </span>
                      <span className="text-sm text-[#1e1e1e]">
                        srini@gmail.com
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#717182]">
                        Dates
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 px-2 py-1 bg-[#f0e5d8] border border-[#e5d4c1] rounded">
                          <Calendar className="w-3 h-3 text-[#717182]" />
                          <span className="text-[#1e1e1e] text-sm">
                            Start
                          </span>
                        </div>
                        <span className="text-[#717182]">
                          →
                        </span>
                        <div className="flex items-center gap-1 px-2 py-1 bg-[#f0e5d8] border border-[#e5d4c1] rounded">
                          <Target className="w-3 h-3 text-[#717182]" />
                          <span className="text-[#1e1e1e] text-sm">
                            Target
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#717182]">
                        Teams
                      </span>
                      <div className="flex items-center gap-1 px-2 py-1 bg-[#f0e5d8] border border-[#e5d4c1] rounded">
                        <div className="w-3 h-3 rounded bg-[#976623]" />
                        <span className="text-[#1e1e1e] text-sm">
                          MasonaryTeam
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Activity */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-[#717182]">
                      Activity
                    </h3>
                    <button className="text-sm text-[#976623] hover:underline">
                      See all
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 text-sm">
                      <Circle
                        className="w-1.5 h-1.5 text-blue-500 mt-1.5"
                        fill="currentColor"
                      />
                      <div>
                        <span className="text-[#1e1e1e]">
                          parthauecs@gmail.com
                        </span>
                        <span className="text-[#717182]">
                          {" "}
                          posted an update · Feb 1
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <Circle
                        className="w-1.5 h-1.5 text-blue-500 mt-1.5"
                        fill="currentColor"
                      />
                      <div>
                        <span className="text-[#1e1e1e]">
                          parthauecs@gmail.com
                        </span>
                        <span className="text-[#717182]">
                          {" "}
                          added{" "}
                        </span>
                        <span className="text-[#1e1e1e]">
                          BigPicture
                        </span>
                        <span className="text-[#717182]">
                          {" "}
                          · Jan 28
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <Circle
                        className="w-1.5 h-1.5 text-blue-500 mt-1.5"
                        fill="currentColor"
                      />
                      <div>
                        <span className="text-[#1e1e1e]">
                          parthauecs@gmail.com
                        </span>
                        <span className="text-[#717182]">
                          {" "}
                          posted an update · Jan 1
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <Circle
                        className="w-1.5 h-1.5 text-blue-500 mt-1.5"
                        fill="currentColor"
                      />
                      <div>
                        <span className="text-[#1e1e1e]">
                          parthauecs@gmail.com
                        </span>
                        <span className="text-[#717182]">
                          {" "}
                          added member{" "}
                        </span>
                        <span className="text-[#1e1e1e]">
                          sriviksayan.ragiraman@gmail.com
                        </span>
                        <span className="text-[#717182]">
                          {" "}
                          · Jan 3
                        </span>
                      </div>
                    </div>
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