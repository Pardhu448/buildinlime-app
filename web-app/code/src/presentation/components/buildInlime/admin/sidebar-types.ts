import type { TeamRow } from "@buildinlime/contracts"
// Minimal row shapes the sidebar's presentational sub-navs render. The live
// queries stay in Sidebar (it is the always-mounted subscriber that keeps the
// spine collections warm — see ARCHITECTURE.md §6); these components only take
// the already-queried data as props.

export type SidebarUser = { id: string; name: string | null; email: string }
export type SidebarProject = { id: string; name: string }
export type SidebarBuildUnit = { id: string; name: string }
/** Channel name arrives as jsonb and is unwrapped at render time. */
export type SidebarChannel = { id: string; name: unknown }
// A slice of the wire row rather than a hand-written copy of it: the fields are
// the same data, and only one of the two descriptions is the enforced one.
export type SidebarTeam = Pick<TeamRow, "id" | "name" | "description" | "member_ids">
