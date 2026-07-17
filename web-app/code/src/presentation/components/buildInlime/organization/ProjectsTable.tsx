import { Boxes } from "lucide-react";

type Project = {
  id: string;
  name: string;
  // Concrete facts off the project row. They stand in for the per-project
  // roll-up metrics (health / target / status) until the derived analytics
  // function exists — see the future-work note in projects/index.tsx.
  createdBy: string;
  createdAt: string;
};

interface ProjectsTableProps {
  projects: Project[];
  onProjectClick?: (project: Project) => void;
}

export function ProjectsTable({ projects, onProjectClick }: ProjectsTableProps) {
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
              Created By
            </th>
            <th
              className="text-left px-6 py-3 font-['Instrument_Sans',sans-serif] font-medium text-[12px] text-[#717182] uppercase tracking-wider"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Created At
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr
              key={project.id}
              onClick={() => onProjectClick?.(project)}
              className="border-b border-[#e5d4c1] hover:bg-[#fdf8f2] transition-colors cursor-pointer"
            >
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-[#976623]" />
                  <span
                    className="font-['Instrument_Sans',sans-serif] text-[14px] text-[#1e1e1e]"
                    style={{ fontVariationSettings: "'wdth' 100" }}
                  >
                    {project.name}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4">
                <span
                  className="font-['Instrument_Sans',sans-serif] text-[14px] text-[#1e1e1e]"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {project.createdBy}
                </span>
              </td>
              <td className="px-6 py-4">
                <span
                  className="font-['Instrument_Sans',sans-serif] text-[14px] text-[#717182]"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {project.createdAt}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
