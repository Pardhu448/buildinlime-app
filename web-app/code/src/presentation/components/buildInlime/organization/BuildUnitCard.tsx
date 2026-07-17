import { Package } from "lucide-react";
import type { BuildUnit } from "./BuildUnitsTable";
import { PropertyPill } from "../communication/PropertyPill";

interface BuildUnitCardProps {
  unit: BuildUnit;
  onClick?: () => void;
  isPending?: boolean;
}

export function BuildUnitCard({ unit, onClick, isPending }: BuildUnitCardProps) {
  // taskStatus is never meaningful on a build unit; drop it defensively.
  const properties = unit.properties.filter((p) => p.type !== "taskStatus");

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

      {/* Properties — value pills, same source of truth as the table */}
      {properties.length === 0 ? (
        <p className="text-sm text-[#717182]">No properties</p>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {properties.map((property) => (
            <PropertyPill key={property.id} property={property} showValue />
          ))}
        </div>
      )}
    </div>
  );
}
