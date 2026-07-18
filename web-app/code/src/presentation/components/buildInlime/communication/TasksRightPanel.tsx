import type { TaskRow } from "@buildinlime/contracts"
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

/**
 * What this panel needs off a task: `id`/`name`/`completed` to render, and the two
 * fields the seen-check reads. Sliced off the canonical row rather than demanding
 * a full domain `Task` — it asked for one while using a handful of fields, so
 * every caller had to construct one.
 */
export type PanelTask = Pick<
  TaskRow,
  "id" | "name" | "completed" | "opened_at" | "channel_id"
>

export interface TasksRightPanelProps {
  // Only what the panel reads, sliced off the canonical row. It asked for a full
  // domain `Task` while using `id` and `name`, so every caller had to build one.
  tasks: PanelTask[];
  onTaskClick?: (taskId: string) => void;
  /** Tasks that arrived since the viewer last opened this channel — shown bold with a dot. */
  isUnread?: (task: PanelTask) => boolean;
}

export function TasksRightPanel({ tasks, onTaskClick, isUnread }: TasksRightPanelProps) {
  const [open, setOpen] = useState(true);

  // No count badge here — the unopened-task count belongs on My Tasks in the
  // left sidebar. This rail keeps only the per-task unread dot, which marks
  // WHICH tasks are new rather than how many.
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full mb-3">
        <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Tasks</p>
        {open ? <ChevronDown className="w-3 h-3 text-secondary" /> : <ChevronRight className="w-3 h-3 text-secondary" />}
      </button>
      {open && (
        <div className="space-y-2">
          {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet.</p>}
          {tasks.map((task) => {
            const unread = isUnread?.(task) ?? false;
            return (
              <button key={task.id} onClick={() => onTaskClick?.(task.id)}
                className="w-full flex items-center gap-2 text-left hover:bg-icon-chip px-2 py-1.5 rounded transition-colors">
                {unread ? (
                  <Circle className="w-4 h-4 text-primary shrink-0" fill="currentColor" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <span className={`text-sm ${unread ? "font-semibold text-foreground" : "text-foreground"}`}>
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
