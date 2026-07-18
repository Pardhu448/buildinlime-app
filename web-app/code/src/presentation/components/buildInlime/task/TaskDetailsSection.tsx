export interface TaskDetailsSectionProps {
  channelName: string
  buildUnitName: string
}

/** The right-panel "Details" block: the task's channel and build unit. */
export function TaskDetailsSection({ channelName, buildUnitName }: TaskDetailsSectionProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">Details</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Channel</span>
          <span className="text-sm text-foreground">{channelName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Build Unit</span>
          <span className="text-sm text-foreground">{buildUnitName}</span>
        </div>
      </div>
    </div>
  )
}
