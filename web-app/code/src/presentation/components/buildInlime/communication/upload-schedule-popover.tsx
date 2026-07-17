import { useState } from "react"
import * as Popover from "@radix-ui/react-popover"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameDay,
  isBefore,
  startOfDay,
  getDay,
} from "date-fns"
import { ChevronLeft, ChevronRight, Upload, Clock, AlertTriangle, Loader2 } from "lucide-react"
import type { UploadStatus } from "%/application/hooks/use-pending-resources"

const HOUR_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const hour = i % 12 === 0 ? 12 : i % 12
  const ampm = i < 12 ? "AM" : "PM"
  return { label: `${hour}:00 ${ampm}`, hour: i }
})

interface UploadSchedulePopoverProps {
  resourceId: string
  status: UploadStatus
  scheduledAt: Date | null
  onSchedule: (id: string, scheduledAt: Date | null) => void
}

export function UploadSchedulePopover({
  resourceId,
  status,
  scheduledAt,
  onSchedule,
}: UploadSchedulePopoverProps) {
  const [open, setOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedHour, setSelectedHour] = useState<number | null>(null)

  const today = startOfDay(new Date())
  const monthStart = startOfMonth(calendarMonth)
  const monthEnd = endOfMonth(calendarMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Pad the first week with empty slots
  const startPad = getDay(monthStart) // 0=Sun
  const paddedDays: (Date | null)[] = [
    ...Array(startPad).fill(null),
    ...days,
  ]

  const canSchedule = selectedDate !== null && selectedHour !== null

  const handleUploadNow = () => {
    setOpen(false)
    onSchedule(resourceId, null)
  }

  const handleSchedule = () => {
    if (!selectedDate || selectedHour === null) return
    const scheduled = new Date(selectedDate)
    scheduled.setHours(selectedHour, 0, 0, 0)
    setOpen(false)
    onSchedule(resourceId, scheduled)
  }

  const isBusy = status === "uploading" || status === "awaiting_network"

  const triggerIcon = () => {
    if (status === "uploading" || status === "awaiting_network") {
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
    }
    if (status === "scheduled") {
      return <Clock className="w-3.5 h-3.5 text-primary" />
    }
    if (status === "error") {
      return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
    }
    return <Upload className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
  }

  const triggerTitle = () => {
    if (status === "uploading") return "Uploading…"
    if (status === "awaiting_network") return "Waiting for network — will upload when back online"
    if (status === "scheduled" && scheduledAt)
      return `Scheduled: ${format(scheduledAt, "MMM d, h:mm a")}`
    if (status === "error") return "Upload failed — click to retry"
    return "Schedule upload"
  }

  return (
    <Popover.Root open={open} onOpenChange={isBusy ? undefined : setOpen}>
      <Popover.Trigger asChild>
        <button
          title={triggerTitle()}
          disabled={isBusy}
          className="p-1 rounded transition-colors hover:bg-icon-chip disabled:cursor-not-allowed"
        >
          {triggerIcon()}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className="z-50 w-72 bg-white border border-card-border rounded-lg shadow-lg p-4 font-['Instrument_Sans',sans-serif]"
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            When to upload?
          </p>

          {/* Upload now */}
          <button
            onClick={handleUploadNow}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-primary text-white rounded hover:bg-primary-hover transition-colors mb-4"
          >
            <Upload className="w-4 h-4" />
            Upload Now
          </button>

          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-px bg-card-border" />
            <span className="text-xs text-muted-foreground">or schedule</span>
            <div className="flex-1 h-px bg-card-border" />
          </div>

          {/* Mini calendar */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setCalendarMonth((m) => subMonths(m, 1))}
                className="p-1 hover:bg-icon-chip rounded transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <span className="text-xs font-medium text-foreground">
                {format(calendarMonth, "MMMM yyyy")}
              </span>
              <button
                onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
                className="p-1 hover:bg-icon-chip rounded transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div key={d} className="text-center text-[10px] text-muted-foreground py-0.5">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {paddedDays.map((day, idx) => {
                if (!day) return <div key={`pad-${idx}`} />
                const isPast = isBefore(day, today)
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => !isPast && setSelectedDate(day)}
                    disabled={isPast}
                    className={[
                      "text-center text-xs py-1 rounded transition-colors",
                      isPast ? "text-foreground-disabled cursor-not-allowed" : "hover:bg-icon-chip cursor-pointer",
                      isSelected ? "bg-primary text-white hover:bg-primary-hover" : "text-foreground",
                    ].join(" ")}
                  >
                    {format(day, "d")}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time slot selector */}
          {selectedDate && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1.5">Time slot</p>
              <div className="grid grid-cols-3 gap-1 max-h-28 overflow-y-auto pr-1">
                {HOUR_SLOTS.map(({ label, hour }) => (
                  <button
                    key={hour}
                    onClick={() => setSelectedHour(hour)}
                    className={[
                      "text-xs px-1.5 py-1 rounded border transition-colors",
                      selectedHour === hour
                        ? "bg-primary text-white border-primary"
                        : "border-card-border text-foreground hover:bg-icon-chip",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Schedule button */}
          <button
            onClick={handleSchedule}
            disabled={!canSchedule}
            className="w-full px-3 py-2 text-sm border border-primary text-primary rounded hover:bg-card-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {canSchedule
              ? `Schedule for ${format(selectedDate, "MMM d")} at ${HOUR_SLOTS[selectedHour].label}`
              : "Schedule Upload"}
          </button>

          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Closing this tab will cancel scheduled uploads
          </p>

          <Popover.Arrow className="fill-card-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
