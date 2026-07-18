import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Property } from "%/domain/communication/types";
import { PropertyPill } from "../communication/PropertyPill";

interface ChannelCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /**
   * Route params for the channel this card opens. Absent for a pending (ghost)
   * channel, which has no route to point at yet.
   *
   * These are the router's own params rather than a pre-built URL string: the
   * card used to take `to: string` and render `<Link href={to}>`, which is not a
   * prop TanStack's Link accepts — it computes `href` from `to`/`params` and
   * overwrites whatever was passed, so the interpolated URL was discarded.
   */
  linkParams?: {
    projectId: string;
    buildUnitName: string;
    channelName: string;
  };
  onClick?: () => void;
  isPending?: boolean;
  properties?: Property[];
}

export function ChannelCard({
  icon: Icon,
  title,
  description,
  linkParams,
  onClick,
  isPending,
  properties,
}: ChannelCardProps) {
  const content = (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded bg-icon-chip border border-card-border flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">{title}</h3>
          {isPending && (
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
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
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

  if (linkParams && !isPending) {
    return (
      <Link
        to="/projects/$projectId/$buildUnitName/$channelName"
        params={linkParams}
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
