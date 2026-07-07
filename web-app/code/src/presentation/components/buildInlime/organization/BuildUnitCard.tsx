import { Package } from "lucide-react";
import type { BuildUnit } from "./BuildUnitsTable";

interface BuildUnitCardProps {
  unit: BuildUnit;
  onClick?: () => void;
  isPending?: boolean;
}

const getHealthColor = (health: string) => {
  switch (health) {
    case "On track":
      return "text-green-600";
    case "At risk":
      return "text-yellow-600";
    case "Off track":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "High":
      return "text-red-600";
    case "Mid":
      return "text-yellow-600";
    case "Low":
      return "text-blue-600";
    default:
      return "text-gray-600";
  }
};

export function BuildUnitCard({ unit, onClick, isPending }: BuildUnitCardProps) {
  return (
    <div
      onClick={!isPending ? onClick : undefined}
      className={`bg-[#fdf8f2] border border-[#e5d4c1] rounded-lg p-4 transition-colors ${
        isPending ? "opacity-70 cursor-default" : "hover:bg-[#f0e5d8] cursor-pointer"
      }`}
    >
      {/* Header: icon + name */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded bg-[#f0e5d8] border border-[#e5d4c1] flex items-center justify-center shrink-0">
          <Package className="w-5 h-5 text-[#976623]" />
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-semibold text-[#1e1e1e] truncate">{unit.name}</h3>
          {isPending && (
            <svg
              className="animate-spin w-3 h-3 text-[#976623] shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>
      </div>

      {/* Health + Priority */}
      <div className="flex items-center gap-4 mb-3 text-sm">
        <span className={`font-medium ${getHealthColor(unit.health)}`}>{unit.health}</span>
        <span className={`font-medium ${getPriorityColor(unit.priority)}`}>{unit.priority}</span>
      </div>

      {/* Latest task + target date */}
      <div className="flex items-center justify-between gap-2 mb-3 text-sm text-[#717182]">
        <span className="truncate">Latest: {unit.waitingOnTask.name}</span>
        <span className="shrink-0">{unit.targetDate}</span>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#976623] rounded-full"
            style={{ width: `${unit.statusPercent}%` }}
          />
        </div>
        <span className="text-sm text-[#717182] shrink-0">{unit.statusPercent}%</span>
      </div>
    </div>
  );
}
