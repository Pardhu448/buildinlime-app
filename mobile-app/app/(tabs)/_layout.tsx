import { Drawer } from "expo-router/drawer"
import DrawerContent from "@/src/presentation/shared/components/DrawerContent"

export default function DrawerLayout() {
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
