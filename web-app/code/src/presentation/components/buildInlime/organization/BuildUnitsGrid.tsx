import { BuildUnitCard } from "./BuildUnitCard";
import type { BuildUnit } from "./BuildUnitsTable";

interface BuildUnitsGridProps {
  buildUnits: BuildUnit[];
  onBuildUnitClick?: (buildUnit: BuildUnit) => void;
  onDeleteBuildUnit?: (buildUnit: BuildUnit) => void;
  pendingIds?: Set<string>;
}

export function BuildUnitsGrid({ buildUnits, onBuildUnitClick, onDeleteBuildUnit, pendingIds }: BuildUnitsGridProps) {
  return (
    <div className="flex-1 overflow-auto bg-white p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {buildUnits.map((unit) => (
          <BuildUnitCard
            key={unit.id}
            unit={unit}
            onClick={() => onBuildUnitClick?.(unit)}
            onDelete={onDeleteBuildUnit}
            isPending={pendingIds?.has(unit.id)}
          />
        ))}
      </div>
    </div>
  );
}
