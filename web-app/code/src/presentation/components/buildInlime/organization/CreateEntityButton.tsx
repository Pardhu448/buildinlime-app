import { Plus } from "lucide-react"

export interface CreateEntityButtonProps {
  label: string
  onClick: () => void
}

/** The primary "New <entity>" pill button that opens a create modal. Shared by
 *  the New Project / Build Unit / Channel buttons. */
export function CreateEntityButton({ label, onClick }: CreateEntityButtonProps) {
  return (
    <button
      onClick={onClick}
      className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
    >
      <Plus className="w-4 h-4" />
      <span
        className="font-['Instrument_Sans',sans-serif] font-medium text-[14px]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {label}
      </span>
    </button>
  )
}
