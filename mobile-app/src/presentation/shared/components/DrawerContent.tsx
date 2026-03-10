import { DrawerContentScrollView } from "@react-navigation/drawer"
import type { DrawerContentComponentProps } from "@react-navigation/drawer"
import { useRouter } from "expo-router"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { useSession } from "@/src/infrastructure/auth/client"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import { colors } from "../colors"

interface NavItem {
  label: string
  route: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", route: "/(tabs)/", icon: "⌂" },
  { label: "My Tasks", route: "/(tabs)/my-tasks", icon: "✓" },
  { label: "Inbox", route: "/(tabs)/inbox", icon: "✉" },
]

export default function DrawerContent(_props: DrawerContentComponentProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const { projectId } = useProjectContext()

  const user = session?.user
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?"

  return (
    <DrawerContentScrollView
      contentContainerStyle={styles.container}
      scrollEnabled={false}
    >
      {/* App brand */}
      <View style={styles.brand}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>B</Text>
        </View>
        <Text style={styles.brandName}>BuildInLime</Text>
      </View>

      <View style={styles.divider} />

      {/* Project badge */}
      {projectId && (
        <TouchableOpacity
          style={styles.projectBadge}
          onPress={() => router.push("/(tabs)/")}
          activeOpacity={0.7}
        >
          <Text style={styles.projectBadgeLabel}>Project</Text>
          <Text style={styles.projectBadgeId} numberOfLines={1}>
            Switch project
          </Text>
        </TouchableOpacity>
      )}

      {/* Nav items */}
      <View style={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.navItem}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.navIcon}>{item.icon}</Text>
            <Text style={styles.navLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Footer — user info + profile link */}
      <View style={styles.footer}>
        <View style={styles.divider} />
        <TouchableOpacity
          style={styles.userRow}
          onPress={() => router.push("/(tabs)/profile")}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.name ?? "Unknown"}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {user?.email ?? ""}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: colors.background,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandMarkText: {
    color: colors.primaryForeground,
    fontSize: 18,
    fontFamily: "InstrumentSans_700Bold",
  },
  brandName: {
    fontSize: 16,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.3,
    marginVertical: 12,
  },
  projectBadge: {
    backgroundColor: colors.muted,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  projectBadgeLabel: {
    fontSize: 10,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  projectBadgeId: {
    fontSize: 13,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.primary,
    marginTop: 2,
  },
  nav: {
    gap: 2,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  navIcon: {
    fontSize: 16,
    color: colors.foreground,
    width: 20,
    textAlign: "center",
  },
  navLabel: {
    fontSize: 15,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.foreground,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 20,
    right: 20,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.primaryForeground,
    fontSize: 13,
    fontFamily: "InstrumentSans_600SemiBold",
  },
  userName: {
    fontSize: 14,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
  },
  userEmail: {
    fontSize: 12,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
  },
})
