import { useState } from "react";
import { Circle, ChevronDown, ChevronRight } from "lucide-react";

export interface Task {
  id: string;
  name: string;
  completed?: boolean;
  // Needed by the timestamp "seen" model: a task is unseen if it was created
  // after the viewer last opened this channel (see useSeen.isTaskUnseen).
  opened_at: string | Date;
  channel_id: string;
}

export interface TasksRightPanelProps {
  tasks: Task[];
  onTaskClick?: (taskId: string) => void;
  /** Tasks that arrived since the viewer last opened this channel — shown bold with a dot. */
  isUnread?: (task: Task) => boolean;
}

export function TasksRightPanel({ tasks, onTaskClick, isUnread }: TasksRightPanelProps) {
  const [open, setOpen] = useState(true);

  // No count badge here — the unopened-task count belongs on My Tasks in the
  // left sidebar. This rail keeps only the per-task unread dot, which marks
  // WHICH tasks are new rather than how many.
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full mb-3">
        <p className="text-xs font-semibold text-[#ac7f5e] uppercase tracking-wider">Tasks</p>
        {open ? <ChevronDown className="w-3 h-3 text-[#ac7f5e]" /> : <ChevronRight className="w-3 h-3 text-[#ac7f5e]" />}
      </button>
      {open && (
        <div className="space-y-2">
          {tasks.length === 0 && <p className="text-sm text-[#717182]">No tasks yet.</p>}
          {tasks.map((task) => {
            const unread = isUnread?.(task) ?? false;
            return (
              <button key={task.id} onClick={() => onTaskClick?.(task.id)}
                className="w-full flex items-center gap-2 text-left hover:bg-[#f0e5d8] px-2 py-1.5 rounded transition-colors">
                {unread ? (
                  <Circle className="w-4 h-4 text-[#976623] shrink-0" fill="currentColor" />
                ) : (
                  <Circle className="w-4 h-4 text-[#717182] shrink-0" />
                )}
                <span className={`text-sm ${unread ? "font-semibold text-[#1e1e1e]" : "text-[#1e1e1e]"}`}>
                  {task.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
