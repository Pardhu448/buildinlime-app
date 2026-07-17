import { useState } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import type { BuildUnit } from "./BuildUnitsTable";

// One filter value per column shown in the build units table. Empty string
// means "no constraint" for that column.
export interface BuildUnitFilters {
  name: string;
  health: "" | BuildUnit["health"];
  priority: "" | BuildUnit["priority"];
  task: string;
  targetDate: string;
  minStatus: string;
}

export const EMPTY_BUILD_UNIT_FILTERS: BuildUnitFilters = {
  name: "",
  health: "",
  priority: "",
  task: "",
  targetDate: "",
  minStatus: "",
};

// Pure helper so the route can derive the visible rows from the applied filters.
export function applyBuildUnitFilters(units: BuildUnit[], f: BuildUnitFilters): BuildUnit[] {
  return units.filter((u) => {
    if (f.name.trim() && !u.name.toLowerCase().includes(f.name.trim().toLowerCase())) return false;
    if (f.health && u.health !== f.health) return false;
    if (f.priority && u.priority !== f.priority) return false;
    if (f.task.trim() && !u.waitingOnTask.name.toLowerCase().includes(f.task.trim().toLowerCase())) return false;
    if (f.targetDate.trim() && !u.targetDate.toLowerCase().includes(f.targetDate.trim().toLowerCase())) return false;
    if (f.minStatus.trim()) {
      const min = parseInt(f.minStatus, 10);
      if (!Number.isNaN(min) && u.statusPercent < min) return false;
    }
    return true;
  });
}

interface BuildUnitsFilterPanelProps {
  initialFilters: BuildUnitFilters;
  onApply: (filters: BuildUnitFilters) => void;
  onClose: () => void;
}

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#976623] focus:border-transparent";
const labelClass = "block text-xs font-medium text-[#717182] uppercase tracking-wider mb-1";

export function BuildUnitsFilterPanel({ initialFilters, onApply, onClose }: BuildUnitsFilterPanelProps) {
  // Draft state, seeded from the currently-applied filters. The panel unmounts
  // when closed, so this re-seeds from the latest applied values on each open.
  const [draft, setDraft] = useState<BuildUnitFilters>(initialFilters);

  const update = <TKey extends keyof BuildUnitFilters>(key: TKey, value: BuildUnitFilters[TKey]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onApply(draft);
  };

  const handleClear = () => {
    setDraft(EMPTY_BUILD_UNIT_FILTERS);
    onApply(EMPTY_BUILD_UNIT_FILTERS);
  };

  return (
    <aside className="w-72 shrink-0 border-l border-card-border bg-white overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-card-border">
        <h2 className="font-semibold text-[14px] text-[#1e1e1e]">Filters</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close filters"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Name */}
        <div>
          <label className={labelClass}>Name</label>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Contains…"
            className={inputClass}
          />
        </div>

        {/* Health */}
        <div>
          <label className={labelClass}>Health</label>
          <select
            value={draft.health}
            onChange={(e) => update("health", e.target.value as BuildUnitFilters["health"])}
            className={inputClass}
          >
            <option value="">All</option>
            <option value="On track">On track</option>
            <option value="At risk">At risk</option>
            <option value="Off track">Off track</option>
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className={labelClass}>Priority</label>
          <select
            value={draft.priority}
            onChange={(e) => update("priority", e.target.value as BuildUnitFilters["priority"])}
            className={inputClass}
          >
            <option value="">All</option>
            <option value="High">High</option>
            <option value="Mid">Mid</option>
            <option value="Low">Low</option>
          </select>
        </div>

        {/* Latest Task */}
        <div>
          <label className={labelClass}>Latest Task</label>
          <input
            type="text"
            value={draft.task}
            onChange={(e) => update("task", e.target.value)}
            placeholder="Contains…"
            className={inputClass}
          />
        </div>

        {/* Target Date */}
        <div>
          <label className={labelClass}>Target Date</label>
          <input
            type="text"
            value={draft.targetDate}
            onChange={(e) => update("targetDate", e.target.value)}
            placeholder="Contains…"
            className={inputClass}
          />
        </div>

        {/* Status (minimum %) */}
        <div>
          <label className={labelClass}>Status is at least (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={draft.minStatus}
            onChange={(e) => update("minStatus", e.target.value)}
            placeholder="0–100"
            className={inputClass}
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            className="flex-1 bg-[#976623] hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[#717182] hover:text-[#1e1e1e] hover:bg-gray-50 transition-colors"
          >
            Clear
          </button>
        </div>
      </form>
    </aside>
  );
}
