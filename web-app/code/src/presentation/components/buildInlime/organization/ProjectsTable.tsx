import { Package } from "lucide-react";

type Project = {
  id: string;
  name: string;
  //health: "On track" | "At risk" | "Off track";
  priority: "High" | "Mid" | "Low";
  /* lead: {
    name: string;
    initials: string;
    color: string;
  }; */
  targetDate: string;
  statusPercent: number;
};

interface ProjectsTableProps {
  projects: Project[];
  onProjectClick?: (project: Project) => void;
}

export function ProjectsTable({ projects, onProjectClick }: ProjectsTableProps) {
  /* const getHealthColor = (health: string) => {
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
  }; */

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
            {/* <th
              className="text-left px-6 py-3 font-['Instrument_Sans',sans-serif] font-medium text-[12px] text-[#717182] uppercase tracking-wider"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Health
            </th> */}
            <th
              className="text-left px-6 py-3 font-['Instrument_Sans',sans-serif] font-medium text-[12px] text-[#717182] uppercase tracking-wider"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Priority
            </th>
            {/* <th
              className="text-left px-6 py-3 font-['Instrument_Sans',sans-serif] font-medium text-[12px] text-[#717182] uppercase tracking-wider"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Lead
            </th> */}
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
          {projects.map((unit) => (
            <tr
              key={unit.id}
              onClick={() => onProjectClick?.(unit)}
              className="border-b border-[#e5d4c1] hover:bg-[#fdf8f2] transition-colors cursor-pointer"
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
              {/* <td className="px-6 py-4">
                <span
                  className={`font-['Instrument_Sans',sans-serif] text-[14px] font-medium ${getHealthColor(
                    unit.health
                  )}`}
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {unit.health}
                </span>
              </td> */}
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
              {/* <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
                    style={{ backgroundColor: unit.lead.color }}
                  >
                    {unit.lead.initials}
                  </div>
                  <span
                    className="font-['Instrument_Sans',sans-serif] text-[14px] text-[#1e1e1e]"
                    style={{ fontVariationSettings: "'wdth' 100" }}
                  >
                    {unit.lead.name}
                  </span>
                </div>
              </td> */}
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
