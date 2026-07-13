import { useState } from "react"
import { Plus } from "lucide-react"
import { useLiveQuery } from "@tanstack/react-db"
import {
  usersCollection,
} from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { updateTaskAction } from "%/application/actions/tasks"

interface AssignedToSectionProps {
  taskId: string
  currentAssigneeId: string | null
  channelMemberIds: string[]
  /** Whether the viewer created this task. Only the creator may assign it —
   *  the real enforcement is in the tasks.update tRPC procedure; hiding the
   *  button here is only so non-creators aren't offered an action that 403s. */
  canAssign?: boolean
}

export function AssignedToSection({
  taskId,
  currentAssigneeId,
  channelMemberIds,
  canAssign = false,
}: AssignedToSectionProps) {
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: allUsers } = useLiveQuery(
    (q) => q.from({ usersCollection }),
    []
  )
  const users = (allUsers ?? []).filter((u) => channelMemberIds.includes(u.id))
  const assignee = users.find((u) => u.id === currentAssigneeId) ?? null

  async function handleSubmit() {
    if (!selectedUserId) return
    setIsSubmitting(true)
    try {
      updateTaskAction({ id: taskId, patch: { assignee_id: selectedUserId } })
      setIsPopupOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex items-center gap-0 py-2">
      <span className="text-sm text-[#717182] w-32 shrink-0">Assigned To</span>

      {canAssign && (
        <button
          onClick={() => { setSelectedUserId(""); setIsPopupOpen(true) }}
          title="Assign this task"
          className="p-0.5 text-[#717182] hover:bg-gray-100 rounded transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}

      {assignee ? (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
          {assignee.name || assignee.email}
        </span>
      ) : (
        !canAssign && <span className="text-sm text-[#717182]">Unassigned</span>
      )}

      {isPopupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setIsPopupOpen(false)}>
          <div
            className="bg-white rounded-lg shadow-xl p-5 w-72 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-[#1e1e1e]">Assign To</h3>

            <select
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm text-[#1e1e1e] focus:outline-none focus:ring-2 focus:ring-[#ac7f5e]"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">— select a member —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name || u.email}</option>
              ))}
            </select>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsPopupOpen(false)}
                className="px-3 py-1.5 text-sm text-[#717182] hover:bg-gray-100 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedUserId || isSubmitting}
                className="px-3 py-1.5 text-sm font-medium bg-[#ac7f5e] text-white rounded hover:bg-[#9b6e4d] disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? "Saving…" : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
