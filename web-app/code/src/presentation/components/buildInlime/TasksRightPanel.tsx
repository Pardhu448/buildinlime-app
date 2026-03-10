import { useState } from "react";
import { Circle, ChevronDown, ChevronRight } from "lucide-react";

export interface Task {
  id: string;
  name: string;
  completed?: boolean;
}

export interface TasksRightPanelProps {
  tasks: Task[];
  onTaskClick?: (taskId: string) => void;
}

export function TasksRightPanel({ tasks, onTaskClick }: TasksRightPanelProps) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full mb-3">
        <p className="text-xs font-semibold text-[#ac7f5e] uppercase tracking-wider">Tasks</p>
        {open ? <ChevronDown className="w-3 h-3 text-[#ac7f5e]" /> : <ChevronRight className="w-3 h-3 text-[#ac7f5e]" />}
      </button>
      {open && (
        <div className="space-y-2">
          {tasks.length === 0 && <p className="text-sm text-[#717182]">No tasks yet.</p>}
          {tasks.map((task) => (
            <button key={task.id} onClick={() => onTaskClick?.(task.id)}
              className="w-full flex items-center gap-2 text-left hover:bg-[#f0e5d8] px-2 py-1.5 rounded transition-colors">
              <Circle className="w-4 h-4 text-[#717182]" />
              <span className="text-sm text-[#1e1e1e]">{task.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
