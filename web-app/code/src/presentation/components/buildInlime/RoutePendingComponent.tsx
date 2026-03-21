import { Sidebar } from "./admin/Sidebar"

export function RoutePendingComponent() {
  return (
    <div className="flex h-screen bg-white font-['Instrument_Sans',sans-serif]">
      <Sidebar />
      <div className="flex-1 flex items-center justify-center text-[#717182]">
        Loading…
      </div>
    </div>
  )
}
