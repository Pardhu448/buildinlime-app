import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { UserInfo } from "./UserInfo";
import { InboxNav } from "./InboxNav";
import { MyTasksNav } from "./MyTasksNav";
import { TrySection } from "../TrySection";
import { BottomSection } from "../BottomSection";

export interface SidebarProjectsProps {
  buildUnitsNavTo?: string;
  buildUnitsNavActive?: boolean;
}

export function SidebarProjects({ buildUnitsNavTo, buildUnitsNavActive }: SidebarProjectsProps) {
  return (
    <aside className="w-60 bg-card-surface border-r border-card-border flex flex-col">
      {/* User info */}
      <UserInfo initials="PE" name="ParthaE" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1 mb-6">
          <InboxNav />
          <MyTasksNav />
        </div>

        {/* Try section */}
        <TrySection />
      </nav>

      {/* Bottom section */}
      <BottomSection />
    </aside>
  );
}
