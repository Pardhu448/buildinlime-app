import {
  IndianRupee,
  NotebookPen,
  Ruler,
  Truck,
  Hammer,
  ClipboardCheck,
  FlaskConical,
} from "lucide-react-native"
import type { LucideIcon } from "lucide-react-native"
import type { ChannelName } from "@buildinlime/domain-types"

// Mirrors web-app/code/src/presentation/lib/channelIcons.ts — keep the two in step.
export const CHANNEL_ICONS: Record<ChannelName, LucideIcon> = {
  Finance: IndianRupee,
  Requirements: NotebookPen,
  Design: Ruler,
  Materials: Truck,
  Tools: Hammer,
  Execution: ClipboardCheck,
  Experimentation: FlaskConical,
}
