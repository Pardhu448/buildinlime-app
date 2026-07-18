import { UserInfo } from "./UserInfo";
import { InboxNav } from "./InboxNav";
import { MyTasksNav } from "./MyTasksNav";
import { TrySection } from "../TrySection";
import { BottomSection } from "../BottomSection";

export interface SidebarProjectsProps {
  buildUnitsNavTo?: string;
  buildUnitsNavActive?: boolean;
}

// NOTE: nothing renders this today — it is only re-exported from the barrel.
// Props are declared but unused; kept rather than deleted because removing a UI
// component is a product call, not a typecheck one.
export function SidebarProjects(_props: SidebarProjectsProps) {
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
