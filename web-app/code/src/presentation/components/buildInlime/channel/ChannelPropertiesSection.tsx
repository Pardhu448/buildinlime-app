import { ChevronDown, ChevronRight } from "lucide-react"
import type { Property } from "%/domain/communication/types"
import { PropertiesPanel } from "../communication/PropertiesPanel"

export interface ChannelPropertiesSectionProps {
  channelProperties: Property[]
  channelId: string
  buildUnitProperties: Property[]
  buildUnitId: string
  buildUnitName: string
  // Collapse state is owned by the page so it survives hiding/showing the right
  // panel (which unmounts this subtree).
  propertiesOpen: boolean
  setPropertiesOpen: (open: boolean) => void
  channelPropsOpen: boolean
  setChannelPropsOpen: (open: boolean) => void
  buildUnitPropsOpen: boolean
  setBuildUnitPropsOpen: (open: boolean) => void
}

/** The right-panel "Properties" block: a collapsible with Channel and Build Unit
 *  sub-sections, each wrapping a read-only PropertiesPanel. */
export function ChannelPropertiesSection({
  channelProperties,
  channelId,
  buildUnitProperties,
  buildUnitId,
  buildUnitName,
  propertiesOpen,
  setPropertiesOpen,
  channelPropsOpen,
  setChannelPropsOpen,
  buildUnitPropsOpen,
  setBuildUnitPropsOpen,
}: ChannelPropertiesSectionProps) {
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
        <div className="space-y-6">
          {/* Channel sub-section */}
          <div>
            <button
              onClick={() => setChannelPropsOpen(!channelPropsOpen)}
              className="flex items-center justify-between w-full mb-3"
            >
              <p className="text-xs text-secondary">Channel</p>
              {channelPropsOpen
                ? <ChevronDown className="w-3 h-3 text-secondary" />
                : <ChevronRight className="w-3 h-3 text-secondary" />
              }
            </button>
            {channelPropsOpen && (
              <PropertiesPanel properties={channelProperties} entityId={channelId} hideLabel hideAddButton />
            )}
          </div>
          {/* Build Unit sub-section */}
          <div>
            <button
              onClick={() => setBuildUnitPropsOpen(!buildUnitPropsOpen)}
              className="flex items-center justify-between w-full mb-3"
            >
              <p className="text-xs text-secondary">Build Unit</p>
              {buildUnitPropsOpen
                ? <ChevronDown className="w-3 h-3 text-secondary" />
                : <ChevronRight className="w-3 h-3 text-secondary" />
              }
            </button>
            {buildUnitPropsOpen && (
              <PropertiesPanel properties={buildUnitProperties} entityId={buildUnitId} hideAddButton label={buildUnitName} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
