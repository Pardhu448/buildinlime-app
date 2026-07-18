// Barrel for all per-entity offline action modules. Each module exports its
// action creators and a `resetXActions()` function that clears its lazily-bound
// references so the next executor (re)init can rebind them.
//
// Mirrors mobile's actions/index.ts. It exists so the reset list is STRUCTURAL
// rather than remembered: signOutAndDispose used to enumerate the resets by
// hand and had drifted to five of six — seen was exported and never called, so
// markSeenAction kept a binding to the signed-out session's executor and
// collection. Add a module here, not at the call site.

import { resetTaskActions } from "./tasks"
import { resetMessageActions } from "./messages"
import { resetResourceActions } from "./resources"
import { resetPropertyActions } from "./properties"
import { resetSeenActions } from "./seen"
import { resetTeamActions } from "./teams"

export function resetAllOfflineActions(): void {
  resetTaskActions()
  resetMessageActions()
  resetResourceActions()
  resetPropertyActions()
  resetSeenActions()
  resetTeamActions()
}
