import { ChevronDown, ChevronRight } from "lucide-react"
import type { Property } from "%/domain/communication/types"
import { PropertiesPanel } from "../communication/PropertiesPanel"

export interface TaskPropertiesSectionProps {
  properties: Property[]
  taskId: string
  // Collapse state is owned by the page so it survives hiding/showing the right
  // panel (which unmounts this subtree).
  propertiesOpen: boolean
  setPropertiesOpen: (open: boolean) => void
  taskPropsOpen: boolean
  setTaskPropsOpen: (open: boolean) => void
}

/** The right-panel "Properties" block on the task page: a collapsible with a
 *  single Task sub-section wrapping a read-only PropertiesPanel. */
export function TaskPropertiesSection({
  properties,
  taskId,
  propertiesOpen,
  setPropertiesOpen,
  taskPropsOpen,
  setTaskPropsOpen,
}: TaskPropertiesSectionProps) {
  return (
    <div>
      <button
        onClick={() => setPropertiesOpen(!propertiesOpen)}
        className="flex items-center justify-between w-full mb-4"
      >
        <h3 className="text-sm font-medium text-muted-foreground">Properties</h3>
        {propertiesOpen
          ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground" />
        }
      </button>
      {propertiesOpen && (
        <div>
          {/* Task sub-section */}
          <button
            onClick={() => setTaskPropsOpen(!taskPropsOpen)}
            className="flex items-center justify-between w-full mb-3"
          >
            <p className="text-xs text-secondary">Task</p>
            {taskPropsOpen
              ? <ChevronDown className="w-3 h-3 text-secondary" />
              : <ChevronRight className="w-3 h-3 text-secondary" />
            }
          </button>
          {taskPropsOpen && (
            <PropertiesPanel properties={properties} entityId={taskId} hideLabel hideAddButton />
          )}
        </div>
      )}
    </div>
  )
}
