import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Property } from "%/domain/communication/types";
import { PropertyPill } from "../communication/PropertyPill";

interface ChannelCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  to?: string;
  onClick?: () => void;
  isPending?: boolean;
  properties?: Property[];
}

export function ChannelCard({
  icon: Icon,
  title,
  description,
  to,
  onClick,
  isPending,
  properties,
}: ChannelCardProps) {
  const content = (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded bg-icon-chip border border-card-border flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#976623]" />
        </div>
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[#1e1e1e]">{title}</h3>
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
      <p className="text-sm text-[#717182]">{description}</p>
      {properties && properties.filter((p) => p.type !== "taskStatus").length > 0 && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {properties
            .filter((p) => p.type !== "taskStatus")
            .map((property) => (
              <PropertyPill key={property.id} property={property} showValue />
            ))}
        </div>
      )}
    </>
  );

  if (to && !isPending) {
    return (
      <Link
        href={to}
        className="bg-card-surface border border-card-border rounded-lg p-4 hover:bg-icon-chip transition-colors cursor-pointer block"
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      onClick={!isPending ? onClick : undefined}
      className={`bg-card-surface border border-card-border rounded-lg p-4 transition-colors ${isPending ? "opacity-70 cursor-default" : "hover:bg-icon-chip cursor-pointer"}`}
    >
      {content}
    </div>
  );
}
