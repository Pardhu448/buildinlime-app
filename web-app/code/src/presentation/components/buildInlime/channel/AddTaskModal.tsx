import type { FormEvent } from "react"
import { X } from "lucide-react"
import { Input, Textarea, Label } from "../shared/FormField"

export interface AddTaskModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (e: FormEvent) => void
  taskName: string
  setTaskName: (name: string) => void
  taskDesc: string
  setTaskDesc: (desc: string) => void
  isSubmitting: boolean
  taskNameTaken: boolean
}

/** The "Add Task" modal. Clicking the backdrop closes it; the ✕ also clears the
 *  form fields, matching the original behaviour. */
export function AddTaskModal({
  open,
  onClose,
  onSubmit,
  taskName,
  setTaskName,
  taskDesc,
  setTaskDesc,
  isSubmitting,
  taskNameTaken,
}: AddTaskModalProps) {
  if (!open) return null

  const cancelAndClear = () => {
    setTaskName("")
    setTaskDesc("")
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <button
          onClick={cancelAndClear}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Add Task</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Task Name</Label>
            <Input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="Enter task name"
              required
              autoFocus
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={taskDesc}
              onChange={(e) => setTaskDesc(e.target.value)}
              placeholder="Enter a short description"
              rows={3}
            />
          </div>
          {taskNameTaken && (
            <p className="text-sm text-red-700">
              A task with this name already exists in this channel.
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !taskName.trim() || taskNameTaken}
            className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {isSubmitting ? "Adding…" : "Add Task"}
          </button>
        </form>
      </div>
    </div>
  )
}
