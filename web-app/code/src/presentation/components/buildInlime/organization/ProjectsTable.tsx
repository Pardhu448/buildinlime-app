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
        <thead className="bg-card-surface sticky top-0">
          <tr className="border-b border-card-border">
            <th
              className="text-left px-6 py-3 font-['Instrument_Sans',sans-serif] font-medium text-[12px] text-muted-foreground uppercase tracking-wider"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Name
            </th>
            <th
              className="text-left px-6 py-3 font-['Instrument_Sans',sans-serif] font-medium text-[12px] text-muted-foreground uppercase tracking-wider"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Created By
            </th>
            <th
              className="text-left px-6 py-3 font-['Instrument_Sans',sans-serif] font-medium text-[12px] text-muted-foreground uppercase tracking-wider"
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
              className="border-b border-card-border hover:bg-card-surface transition-colors cursor-pointer"
            >
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-primary" />
                  <span
                    className="font-['Instrument_Sans',sans-serif] text-[14px] text-foreground"
                    style={{ fontVariationSettings: "'wdth' 100" }}
                  >
                    {project.name}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4">
                <span
                  className="font-['Instrument_Sans',sans-serif] text-[14px] text-foreground"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {project.createdBy}
                </span>
              </td>
              <td className="px-6 py-4">
                <span
                  className="font-['Instrument_Sans',sans-serif] text-[14px] text-muted-foreground"
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
