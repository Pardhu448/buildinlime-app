// Barrel for all per-entity offline action modules. Each module exports its
// action creators and a `resetXActions()` function that clears its lazily-bound
// references so the next executor (re)init can rebind them.

import { resetTaskActions } from "./tasks"
import { resetProjectActions } from "./projects"
import { resetMessageActions } from "./messages"
import { resetResourceActions } from "./resources"
import { resetPropertyActions } from "./properties"
import { resetTeamActions } from "./teams"
import { resetBuildUnitActions } from "./buildunits"
import { resetChannelActions } from "./channels"
import { resetSeenActions } from "./seen"

export function resetAllOfflineActions(): void {
  resetTaskActions()
  resetProjectActions()
  resetMessageActions()
  resetResourceActions()
  resetPropertyActions()
  resetTeamActions()
  resetBuildUnitActions()
  resetChannelActions()
  resetSeenActions()
}
