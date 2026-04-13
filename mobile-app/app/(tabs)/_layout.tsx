import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, View } from "react-native"
import { Drawer } from "expo-router/drawer"
import DrawerContent from "@/src/presentation/shared/components/DrawerContent"
import { useSession } from "@/src/infrastructure/auth/client"
import { initBootstrapCollections, initProjectCollections } from "@/src/application/collections/init"
import { reconcileOnStartup } from "@/src/application/attachments/store"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import { colors } from "@/src/presentation/shared/colors"

export default function DrawerLayout() {
  const { data: session } = useSession()
  const { projectId, ready: projectCtxReady } = useProjectContext()

  const [bootstrapReady, setBootstrapReady] = useState(false)
  const [projectReady, setProjectReady] = useState(false)
  const bootstrapStarted = useRef(false)
  const projectInitStarted = useRef<string | null>(null)

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
      .then(() => {
        reconcileOnStartup()
        if (__DEV__) console.log(`[layout] Project collections ready`)
        setProjectReady(true)
      })
      .catch((err) => {
        console.error("[layout] Project init failed:", err)
        setProjectReady(true)
      })
  }, [bootstrapReady, projectCtxReady, projectId])

  // Show spinner while bootstrap or project collections are loading.
  // The third condition catches the one-render gap where projectId just
  // changed (e.g. user picked a project) but the Phase 2 effect hasn't
  // fired yet to set projectReady=false — without it, children would
  // render with null collections for one frame.
  const pendingProjectInit = !!projectId && projectInitStarted.current !== projectId
  if (!bootstrapReady || !projectReady || pendingProjectInit) {
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
      <Drawer.Screen name="projects" options={{ drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="project" options={{ drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="two" options={{ drawerItemStyle: { display: "none" } }} />
    </Drawer>
  )
}
