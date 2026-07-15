import { ListTodo } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useMyTasksBadge } from "%/presentation/hooks/use-my-tasks-badge";

export function MyTasksNav() {
  // Tasks assigned to me that I have not opened yet — read from the user-scoped
  // my-tasks slice, not the full tasks collection.
  const { myUnopenedTaskCount } = useMyTasksBadge();

  return (
    <Link
      to="/my-tasks"
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors"
    >
      <ListTodo className="w-4 h-4" />
      <span className={`flex-1 ${myUnopenedTaskCount > 0 ? "font-semibold" : ""}`}>
        My Tasks
      </span>
      {myUnopenedTaskCount > 0 && (
        <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#976623] text-white text-[10px] font-semibold">
          {myUnopenedTaskCount > 99 ? "99+" : myUnopenedTaskCount}
        </span>
      )}
    </Link>
  );
}
