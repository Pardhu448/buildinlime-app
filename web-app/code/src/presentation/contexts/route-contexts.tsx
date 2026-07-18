import type { LucideIcon } from "lucide-react"
import { createContext, useContext } from 'react'

// ── BuildUnit context ─────────────────────────────────────────────────────────
// Provided by the $buildUnitName layout route. Gives all descendants immediate
// access to the resolved buildUnitId without re-querying buildUnitsCollection.

export type BuildUnitContextValue = {
  buildUnitId: string
  buildUnitDesc: string
  projectName: string
}

const BuildUnitContext = createContext<BuildUnitContextValue | null>(null)

export const BuildUnitContextProvider = BuildUnitContext.Provider

export function useBuildUnitContext(): BuildUnitContextValue {
  const ctx = useContext(BuildUnitContext)
  if (!ctx) throw new Error('useBuildUnitContext must be used within the $buildUnitName layout route')
  return ctx
}

// ── Channel context ───────────────────────────────────────────────────────────
// Provided by the $channelName layout route. Gives all descendants immediate
// access to the resolved channelId without re-querying channelsCollection.

export type ChannelContextValue = {
  channelId: string
  channelDescription: string
  // Always a lucide icon (CHANNEL_ICONS, or the ClipboardCheck fallback), and
  // consumers ask for LucideIcon — ElementType was wider than anything supplied.
  channelIcon: LucideIcon
}

const ChannelContext = createContext<ChannelContextValue | null>(null)

export const ChannelContextProvider = ChannelContext.Provider

export function useChannelContext(): ChannelContextValue {
  const ctx = useContext(ChannelContext)
  if (!ctx) throw new Error('useChannelContext must be used within the $channelName layout route')
  return ctx
}
