import { useState } from "react";
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
  Circle,
  Bell,
  Paperclip,
  Send,
  Link as LinkIcon,
  Tag,
  Wrench,
  CalendarClock,
} from "lucide-react";
import { Link } from "react-router";

export function TaskPage() {
  const [expandedWorkspace, setExpandedWorkspace] = useState(true);
  const [expandedTeam, setExpandedTeam] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [expandedMasonaryTeam, setExpandedMasonaryTeam] = useState(true);
  const [expandedProperties, setExpandedProperties] = useState(true);

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
                <Link
                  to="/projects"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors"
                >
                  <Package className="w-4 h-4" />
                  <span>BuildUnits</span>
                </Link>
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
                    <div className="w-5 h-5 rounded bg-[#976623] flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        M
                      </span>
                    </div>
                    <span className="text-sm text-[#1e1e1e] font-medium">
                      MasonryTeam
                    </span>
                    <button
                      onClick={() =>
                        setExpandedMasonaryTeam(!expandedMasonaryTeam)
                      }
                      className="ml-auto opacity-0 group-hover:opacity-100"
                    >
                      {expandedMasonaryTeam ? (
                        <ChevronDown className="w-3 h-3 text-[#717182]" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-[#717182]" />
                      )}
                    </button>
                  </div>
                  {expandedMasonaryTeam && (
                    <div className="ml-7 space-y-1 mt-1">
                      <button className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors">
                        <ListTodo className="w-4 h-4" />
                        <span>Tasks</span>
                      </button>
                      <Link
                        to="/projects/buildinlime"
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors"
                      >
                        <Package className="w-4 h-4" />
                        <span>BuildUnits</span>
                      </Link>
                      <button className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors">
                        <Layers className="w-4 h-4" />
                        <span>Views</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Bottom section */}
        <div className="p-3 border-t border-[#e5d4c1]">
          <div className="bg-[#f0e5d8] border border-[#e5d4c1] rounded-lg p-3">
            <p className="text-xs text-[#1e1e1e] font-medium mb-2">
              What's new
            </p>
            <p className="text-xs text-[#717182]">
              Advanced filters and share issues in private teams
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-12 bg-white border-b border-[#e5d4c1] flex items-center justify-between px-6">
          <div className="flex items-center gap-3 text-sm text-[#717182]">
            <Link
              to="/projects/buildinlime"
              className="hover:text-[#976623] transition-colors"
            >
              Foundation Work
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-[#1e1e1e] font-medium">Task</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1.5 hover:bg-[#f0e5d8] rounded transition-colors">
              <MoreHorizontal className="w-4 h-4 text-[#717182]" />
            </button>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main content */}
          <div className="flex-1 overflow-y-auto px-20 py-12">
            {/* Title */}
            <div className="flex items-center gap-3 mb-3">
              <Wrench className="w-6 h-6 text-[#976623]" />
              <h1 className="text-3xl font-bold text-[#1e1e1e]">
                Initial Requirements
              </h1>
            </div>
            <p className="text-[#717182] mb-8">
              Create initial requirements document with details of what is expected out of the foundation.
            </p>

            {/* Resources */}
            <div className="mb-8">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#717182]">
                  Resources
                </span>
                <button className="p-1 text-[#717182] hover:text-[#976623] transition-colors">
                  <Plus className="w-3 h-3" />
                </button>
                <span className="text-sm text-[#717182]">
                  Add document or link...
                </span>
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <aside className="w-72 bg-[#fdf8f2] border-l border-[#e5d4c1] overflow-y-auto p-6">
            <button
              onClick={() => setExpandedProperties(!expandedProperties)}
              className="w-full flex items-center justify-between mb-4"
            >
              <h2 className="text-xs font-semibold text-[#ac7f5e] uppercase tracking-wider text-left">
                Properties
              </h2>
              {expandedProperties ? (
                <ChevronDown className="w-4 h-4 text-[#ac7f5e]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#ac7f5e]" />
              )}
            </button>

            {expandedProperties && (
              <>
                {/* Set priority */}
                <button className="w-full text-left mb-6">
                  <div className="flex items-center gap-2 text-sm text-[#717182] hover:text-[#976623] transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                    <span>Set priority</span>
                  </div>
                </button>

                {/* Assign */}
                <button className="w-full text-left mb-6">
                  <div className="flex items-center gap-2 text-sm text-[#717182] hover:text-[#976623] transition-colors">
                    <Plus className="w-4 h-4" />
                    <span>Assign</span>
                  </div>
                </button>

                {/* Labels */}
                <div className="mb-6">
                  <p className="text-xs text-[#ac7f5e] mb-2">Labels</p>
                  <button className="w-full text-left">
                    <div className="flex items-center gap-2 text-sm text-[#717182] hover:text-[#976623] transition-colors">
                      <Tag className="w-4 h-4" />
                      <span>Add label</span>
                    </div>
                  </button>
                </div>

                {/* BuildUnit */}
                <div className="mb-6">
                  <p className="text-xs text-[#ac7f5e] mb-2">BuildUnit</p>
                  <Link
                    to="/projects/buildinlime"
                    className="flex items-center gap-2 text-sm text-[#1e1e1e] hover:text-[#976623] transition-colors"
                  >
                    <Package className="w-4 h-4" />
                    <span>Foundation Work</span>
                  </Link>
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
