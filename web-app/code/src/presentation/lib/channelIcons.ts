import {
  IndianRupee,
  NotebookPen,
  Ruler,
  Truck,
  Hammer,
  ClipboardCheck,
  FlaskConical,
} from 'lucide-react'
import { CHANNEL_NAMES } from '%/infrastructure/database/schema/admin-schema'

export const CHANNEL_ICONS: Record<typeof CHANNEL_NAMES[number], typeof IndianRupee> = {
  Finance: IndianRupee,
  Requirements: NotebookPen,
  Design: Ruler,
  Materials: Truck,
  Tools: Hammer,
  Execution: ClipboardCheck,
  Experimentation: FlaskConical,
}
