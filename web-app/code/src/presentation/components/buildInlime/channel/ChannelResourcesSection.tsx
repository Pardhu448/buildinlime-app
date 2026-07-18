import { useState } from "react"
import { ChevronUp, ChevronDown } from "lucide-react"
import { ResourceDisplay } from "../communication/ResourceDisplay"

export interface ChannelResourcesSectionProps {
  channelId: string
  buildUnitId: string
}

/** The collapsible "Resources" block in the channel's main content column. */
export function ChannelResourcesSection({ channelId, buildUnitId }: ChannelResourcesSectionProps) {
  const [resourcesOpen, setResourcesOpen] = useState(true)

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">Resources</h3>
        <button
          onClick={() => setResourcesOpen(!resourcesOpen)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          {resourcesOpen ? (
            <>Hide <ChevronUp className="w-3.5 h-3.5" /></>
          ) : (
            <>Show <ChevronDown className="w-3.5 h-3.5" /></>
          )}
        </button>
      </div>
      {resourcesOpen && <ResourceDisplay channelId={channelId} buildunitId={buildUnitId} />}
    </div>
  )
}
