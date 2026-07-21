import { Boxes, Trash2 } from "lucide-react";

type Project = {
  id: string;
  name: string;
  // Concrete facts off the project row. They stand in for the per-project
  // roll-up metrics (health / target / status) until the derived analytics
  // function exists — see the future-work note in projects/index.tsx.
  createdBy: string;
  createdAt: string;
  // Whether the current user owns this project. The delete affordance is shown
  // only for owned projects — the server enforces owner-only delete regardless
  // (projects.delete returns NOT_FOUND otherwise); hiding the button is courtesy.
  canDelete: boolean;
};

interface ProjectsTableProps {
  projects: Project[];
  onProjectClick?: (project: Project) => void;
  onDeleteProject?: (project: Project) => void;
}

export function ProjectsTable({ projects, onProjectClick, onDeleteProject }: ProjectsTableProps) {
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
            {/* Actions column — header intentionally blank, matches the row action. */}
            <th className="w-12 px-6 py-3" />
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr
              key={project.id}
              onClick={() => onProjectClick?.(project)}
              className="group border-b border-card-border hover:bg-card-surface transition-colors cursor-pointer"
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
              <td className="px-6 py-4 text-right">
                {onDeleteProject && project.canDelete && (
                  <button
                    type="button"
                    // stopPropagation so deleting doesn't also navigate into the row.
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteProject(project);
                    }}
                    title="Delete this project"
                    aria-label={`Delete ${project.name}`}
                    className="p-1.5 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
