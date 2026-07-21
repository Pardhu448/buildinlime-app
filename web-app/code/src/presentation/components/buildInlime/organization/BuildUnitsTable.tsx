import { Package, Trash2 } from "lucide-react";
import type { Property } from "%/domain/communication/types";
import { PropertyPill } from "../communication/PropertyPill";

export type BuildUnit = {
  id: string;
  name: string;
  // The build unit's live properties (status, priority, target date, % complete,
  // …) — the source of truth shown in the table. The fields below are legacy
  // columns off the build_units row, kept only because the grid/thumbnail view
  // and the filter panel still read them; they are not shown in the table.
  properties: Property[];
  health: "On track" | "At risk" | "Off track";
  priority: "High" | "Mid" | "Low";
  waitingOnTask: {
    name: string;
    assignee: string;
    since: string;
  };
  targetDate: string;
  statusPercent: number;
  // Whether the current user owns this build unit — gates the delete affordance.
  canDelete: boolean;
};

interface BuildUnitsTableProps {
  buildUnits: BuildUnit[];
  onBuildUnitClick?: (buildUnit: BuildUnit) => void;
  onDeleteBuildUnit?: (buildUnit: BuildUnit) => void;
  pendingIds?: Set<string>;
}

export function BuildUnitsTable({ buildUnits, onBuildUnitClick, onDeleteBuildUnit, pendingIds }: BuildUnitsTableProps) {
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
              Properties
            </th>
            <th className="w-12 px-6 py-3" />
          </tr>
        </thead>
        <tbody>
          {buildUnits.map((unit) => {
            // taskStatus is never meaningful on a build unit; drop it defensively
            // so the row can never render a stray task-completion pill.
            const properties = unit.properties.filter((p) => p.type !== "taskStatus");
            return (
              <tr
                key={unit.id}
                className="group border-b border-card-border hover:bg-card-surface transition-colors cursor-pointer"
                onClick={() => onBuildUnitClick?.(unit)}
              >
                <td className="px-6 py-4 align-top">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary shrink-0" />
                    <span
                      className="font-['Instrument_Sans',sans-serif] text-[14px] text-foreground"
                      style={{ fontVariationSettings: "'wdth' 100" }}
                    >
                      {unit.name}
                    </span>
                    {pendingIds?.has(unit.id) && (
                      <svg
                        className="animate-spin w-3 h-3 text-primary shrink-0"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {properties.length === 0 ? (
                    <span
                      className="font-['Instrument_Sans',sans-serif] text-[14px] text-muted-foreground"
                      style={{ fontVariationSettings: "'wdth' 100" }}
                    >
                      —
                    </span>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {properties.map((property) => (
                        <PropertyPill key={property.id} property={property} showValue />
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 align-top text-right">
                  {onDeleteBuildUnit && unit.canDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBuildUnit(unit);
                      }}
                      title="Delete this build unit"
                      aria-label={`Delete ${unit.name}`}
                      className="p-1.5 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
