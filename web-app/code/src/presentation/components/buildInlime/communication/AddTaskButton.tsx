import { CalendarClock, UserPlus } from "lucide-react";

interface AddTaskButtonProps {
  onClick?: () => void;
  onAddPeople?: () => void;
}

export function AddTaskButton({ onClick, onAddPeople }: AddTaskButtonProps) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <button
        onClick={onClick}
        className="flex items-center gap-2 text-[#717182] hover:text-[#976623] transition-colors"
      >
        <CalendarClock className="w-4 h-4" />
        <span className="text-sm">Add Task</span>
      </button>
      {onAddPeople && (
        <button
          onClick={onAddPeople}
          className="flex items-center gap-2 text-[#717182] hover:text-[#976623] transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span className="text-sm">Add People</span>
        </button>
      )}
    </div>
  );
}
