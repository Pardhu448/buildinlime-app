import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, View } from "react-native"
import { Drawer } from "expo-router/drawer"
import DrawerContent from "@/src/presentation/shared/components/DrawerContent"
import { useSession } from "@/src/infrastructure/auth/client"
import {
  initBootstrapCollections,
  initProjectCollections,
  membershipSetsChanged,
  resyncProjectCollections,
} from "@/src/application/collections/init"
import { membershipsCollection } from "@/src/application/collections/admin"
import { initOfflineExecutor } from "@/src/infrastructure/offline/executor"
import { initUploadManager } from "@/src/infrastructure/offline/upload-manager"
import { resetAllOfflineActions } from "@/src/application/actions"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import { colors } from "@/src/presentation/shared/colors"

export default function DrawerLayout() {
  const { data: session } = useSession()
  const { projectId, ready: projectCtxReady } = useProjectContext()

  const [bootstrapReady, setBootstrapReady] = useState(false)
  const [projectReady, setProjectReady] = useState(false)
  const bootstrapStarted = useRef(false)
  const projectInitStarted = useRef<string | null>(null)

  // Runtime scope-change handling (membership-staleness rework). When the
  // current user's visible scope changes, `resyncing` unmounts the content
  // (spinner) so collections can be rebuilt safely, then `dataVersion` re-keys
  // the Drawer so remounted live queries read the freshly-built collections.
  const [resyncing, setResyncing] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)

  // Phase 1: Bootstrap collections (memberships + projects + users)
  useEffect(() => {
    if (!session?.user?.id || bootstrapStarted.current) return
    bootstrapStarted.current = true
    if (__DEV__) console.log("[layout] Starting bootstrap collections")
    initBootstrapCollections()
      .then(() => {
        if (__DEV__) console.log("[layout] Bootstrap ready")
        setBootstrapReady(true)
      })
      .catch((err) => {
        console.error("[layout] Bootstrap failed:", err)
        setBootstrapReady(true)
      })
  }, [session?.user?.id])

  // Phase 2: Once bootstrap is ready and we know the selected project,
  // init scoped collections and navigate to the project view.
  useEffect(() => {
    if (!bootstrapReady || !projectCtxReady) return

    if (!projectId) {
      // No project selected — home screen will act as picker.
      if (__DEV__) console.log("[layout] No project selected, showing picker")
      setProjectReady(true)
      return
    }

    // Guard: don't re-init the same project
    if (projectInitStarted.current === projectId) return
    projectInitStarted.current = projectId
    setProjectReady(false)

    if (__DEV__) console.log(`[layout] Initializing project collections for: ${projectId}`)
    initProjectCollections(projectId)
      .then(async () => {
        // Executor must init AFTER project collections so it can register them.
        // Re-runs on project switch — initOfflineExecutor disposes the previous
        // instance internally before constructing a new one; clear cached
        // action references so the next call binds against the new executor.
        resetAllOfflineActions()
        await initOfflineExecutor()
        // Upload manager: a separate service from the executor (binaries do not
        // belong in the outbox). initUploadManager is idempotent, so re-running
        // it on project switch is a no-op.
        await initUploadManager()
        if (__DEV__) console.log(`[layout] Project collections + offline executor ready`)
        setProjectReady(true)
      })
      .catch((err) => {
        console.error("[layout] Project init failed:", err)
        setProjectReady(true)
      })
  }, [bootstrapReady, projectCtxReady, projectId])

  // Watch the SELF membership stream (server-scoped to user_id = me), so this
  // fires only when THIS user's memberships change — creating a channel, being
  // added to / removed from one — never on roster churn from other users. When
  // the derived visibility/channel sets actually drift from what the live
  // collections were built with, flag a resync (debounced to coalesce bursts).
  useEffect(() => {
    if (!projectReady) return

    // One-shot re-derive. subscribeChanges only fires on FUTURE changes, so
    // memberships that landed DURING init — after the sets were derived, before
    // this subscription existed — would otherwise never be seen, stranding the
    // session on `1 = 0` shapes until the next sign-out. This is also the
    // backstop for a memberships shape that errored during bootstrap and
    // recovered a moment later: the rows are here now, the applied sets are
    // empty, so the keys differ and the existing resync rebuilds every
    // channel-scoped shape with the real channel ids.
    if (membershipSetsChanged(projectId)) setResyncing(true)

    let timer: ReturnType<typeof setTimeout> | null = null
    const sub = membershipsCollection.subscribeChanges(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        if (membershipSetsChanged(projectId)) setResyncing(true)
      }, 400)
    })
    return () => {
      if (timer) clearTimeout(timer)
      sub.unsubscribe()
    }
  }, [projectReady, projectId])

  // Run the resync only AFTER the content has unmounted (resyncing=true renders
  // the spinner), so cleanup() never runs against collections a mounted live
  // query still references. Rebind the offline executor to the freshly-built
  // instances (it captured the old ones by value), then bump dataVersion to
  // re-key the Drawer so remounted queries read the new collections.
  useEffect(() => {
    if (!resyncing) return
    let cancelled = false
    void (async () => {
      try {
        const changed = await resyncProjectCollections(projectId)
        if (cancelled) return
        if (changed) {
          resetAllOfflineActions()
          await initOfflineExecutor()
          if (cancelled) return
          setDataVersion((v) => v + 1)
        }
      } catch (err) {
        console.error("[layout] Resync failed:", err)
      } finally {
        if (!cancelled) setResyncing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [resyncing, projectId])

  // Show spinner while bootstrap or project collections are loading.
  // The third condition catches the one-render gap where projectId just
  // changed (e.g. user picked a project) but the Phase 2 effect hasn't
  // fired yet to set projectReady=false — without it, children would
  // render with null collections for one frame.
  const pendingProjectInit = !!projectId && projectInitStarted.current !== projectId
  if (!bootstrapReady || !projectReady || pendingProjectInit || resyncing) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <Drawer
      key={dataVersion}
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: "slide",
        swipeEdgeWidth: 50,
      }}
    >
      <Drawer.Screen name="index" options={{ title: "Home" }} />
      <Drawer.Screen name="my-tasks" options={{ title: "My Tasks" }} />
      <Drawer.Screen name="inbox" options={{ title: "Inbox" }} />
      <Drawer.Screen name="profile" options={{ title: "Profile" }} />
      {/* Hidden screens — navigated to programmatically */}
      <Drawer.Screen name="project" options={{ drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen
        name="offline-debug"
        options={{ drawerItemStyle: { display: "none" }, title: "Offline Debug" }}
      />
    </Drawer>
  )
}
