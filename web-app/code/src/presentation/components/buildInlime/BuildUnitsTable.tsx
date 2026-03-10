import { Package } from "lucide-react";
import { useState } from "react";

type BuildUnit = {
  id: string;
  name: string;
  health: "On track" | "At risk" | "Off track";
  priority: "High" | "Mid" | "Low";
  waitingOnTask: {
    name: string;
    assignee: string;
    since: string;
  };
  targetDate: string;
  statusPercent: number;
};

interface BuildUnitsTableProps {
  buildUnits: BuildUnit[];
  onBuildUnitClick?: (buildUnit: BuildUnit) => void;
}

export function BuildUnitsTable({ buildUnits, onBuildUnitClick }: BuildUnitsTableProps) {
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

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

  return (
    <div className="flex-1 overflow-auto bg-white">
      <table className="w-full">
        <thead className="bg-[#fdf8f2] sticky top-0">
          <tr className="border-b border-[#e5d4c1]">
            <th
              className="text-left px-6 py-3 font-['Instrument_Sans',sans-serif] font-medium text-[12px] text-[#717182] uppercase tracking-wider"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Name
            </th>
            <th
              className="text-left px-6 py-3 font-['Instrument_Sans',sans-serif] font-medium text-[12px] text-[#717182] uppercase tracking-wider"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Health
            </th>
            <th
              className="text-left px-6 py-3 font-['Instrument_Sans',sans-serif] font-medium text-[12px] text-[#717182] uppercase tracking-wider"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Priority
            </th>
            <th
              className="text-left px-6 py-3 font-['Instrument_Sans',sans-serif] font-medium text-[12px] text-[#717182] uppercase tracking-wider"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              LatestTask
            </th>
            <th
              className="text-left px-6 py-3 font-['Instrument_Sans',sans-serif] font-medium text-[12px] text-[#717182] uppercase tracking-wider"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Target Date
            </th>
            <th
              className="text-left px-6 py-3 font-['Instrument_Sans',sans-serif] font-medium text-[12px] text-[#717182] uppercase tracking-wider"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {buildUnits.map((unit) => (
            <tr
              key={unit.id}
              className="border-b border-[#e5d4c1] hover:bg-[#fdf8f2] transition-colors cursor-pointer"
              onClick={() => onBuildUnitClick?.(unit)}
            >
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#976623]" />
                  <span
                    className="font-['Instrument_Sans',sans-serif] text-[14px] text-[#1e1e1e]"
                    style={{ fontVariationSettings: "'wdth' 100" }}
                  >
                    {unit.name}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4">
                <span
                  className={`font-['Instrument_Sans',sans-serif] text-[14px] font-medium ${getHealthColor(
                    unit.health
                  )}`}
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {unit.health}
                </span>
              </td>
              <td className="px-6 py-4">
                <span
                  className={`font-['Instrument_Sans',sans-serif] text-[14px] font-medium ${getPriorityColor(
                    unit.priority
                  )}`}
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {unit.priority}
                </span>
              </td>
              <td className="px-6 py-4 relative">
                <div 
                  className="flex items-center gap-2 cursor-help"
                  onMouseEnter={() => setHoveredTaskId(unit.id)}
                  onMouseLeave={() => setHoveredTaskId(null)}
                >
                  <span
                    className="font-['Instrument_Sans',sans-serif] text-[14px] text-[#1e1e1e]"
                    style={{ fontVariationSettings: "'wdth' 100" }}
                  >
                    {unit.waitingOnTask.name}
                  </span>
                </div>
                {hoveredTaskId === unit.id && (
                  <div className="absolute z-50 left-6 top-10 bg-white border border-[#e5d4c1] rounded-lg shadow-lg p-3 min-w-[180px]">
                    <div className="font-['Instrument_Sans',sans-serif] text-[12px] text-[#717182] font-semibold uppercase tracking-wider mb-2" style={{ fontVariationSettings: "'wdth' 100" }}>
                      Details
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="font-['Instrument_Sans',sans-serif] text-[12px] text-[#717182]" style={{ fontVariationSettings: "'wdth' 100" }}>
                          Task Name:
                        </span>
                        <span className="font-['Instrument_Sans',sans-serif] text-[12px] text-[#1e1e1e]" style={{ fontVariationSettings: "'wdth' 100" }}>
                          {unit.waitingOnTask.name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-['Instrument_Sans',sans-serif] text-[12px] text-[#717182]" style={{ fontVariationSettings: "'wdth' 100" }}>
                          Assignee:
                        </span>
                        <span className="font-['Instrument_Sans',sans-serif] text-[12px] text-[#1e1e1e]" style={{ fontVariationSettings: "'wdth' 100" }}>
                          {unit.waitingOnTask.assignee}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-['Instrument_Sans',sans-serif] text-[12px] text-[#717182]" style={{ fontVariationSettings: "'wdth' 100" }}>
                          Since:
                        </span>
                        <span className="font-['Instrument_Sans',sans-serif] text-[12px] text-[#1e1e1e]" style={{ fontVariationSettings: "'wdth' 100" }}>
                          {unit.waitingOnTask.since}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </td>
              <td className="px-6 py-4">
                <span
                  className="font-['Instrument_Sans',sans-serif] text-[14px] text-[#717182]"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {unit.targetDate}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#976623] rounded-full"
                      style={{ width: `${unit.statusPercent}%` }}
                    />
                  </div>
                  <span
                    className="font-['Instrument_Sans',sans-serif] text-[14px] text-[#717182]"
                    style={{ fontVariationSettings: "'wdth' 100" }}
                  >
                    {unit.statusPercent}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
