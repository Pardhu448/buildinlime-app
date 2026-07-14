import { DrawerContentScrollView } from "@react-navigation/drawer"
import type { DrawerContentComponentProps } from "@react-navigation/drawer"
import { useRouter } from "expo-router"
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Boxes, ListTodo, Inbox, Settings, LogOut } from "lucide-react-native"
import type { LucideIcon } from "lucide-react-native"
import { useSignOut } from "@/app/_layout"
import { useSession } from "@/src/infrastructure/auth/client"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import { useProjects } from "@/src/presentation/projects/hooks/useProjects"
import { useReads } from "@/src/presentation/shared/hooks/useReads"
import { colors } from "../colors"

const brickLogo = require("@/assets/images/brick-logo-brown.png")

type BadgeKind = "tasks" | "inbox"

interface NavItem {
  label: string
  route: string
  icon: LucideIcon
  badge?: BadgeKind
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", route: "/(tabs)/", icon: Boxes },
  { label: "My Tasks", route: "/(tabs)/my-tasks", icon: ListTodo, badge: "tasks" },
  { label: "Inbox", route: "/(tabs)/inbox", icon: Inbox, badge: "inbox" },
  ...(__DEV__
    ? [{ label: "Offline Debug", route: "/(tabs)/offline-debug", icon: Settings }]
    : []),
]

/**
 * Unread counts, same logic as web's sidebar:
 *   My Tasks — tasks assigned to me, not completed, that I have not opened.
 *   Inbox    — messages mentioning me that I have not read.
 *
 * Both are unread counts, NOT "how many exist". My Tasks used to show every open
 * task, so it never went down as you worked and told you nothing new had arrived.
 *
 * Mounted only once a project is selected: messages/tasks stay null until
 * initProjectCollections runs, and the drawer renders before that on the picker.
 */
function UnreadBadge({ kind }: { kind: BadgeKind }) {
  const { myUnopenedTaskCount, unreadMentionCount } = useReads()
  const count = kind === "tasks" ? myUnopenedTaskCount : unreadMentionCount
  if (!count) return null
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
    </View>
  )
}

export default function DrawerContent(_props: DrawerContentComponentProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { startSignOut } = useSignOut()
  const { data: session } = useSession()
  const { projectId } = useProjectContext()
  const { projects } = useProjects()
  const activeProject = projects?.find((p: any) => p.id === projectId)

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
        <Image source={brickLogo} style={styles.brandMark} resizeMode="contain" />
        <Text style={styles.brandName}>BuildInLime</Text>
      </View>

      <View style={styles.divider} />

      {/* Active project (read-only — sign out to switch) */}
      {projectId && (
        <View style={styles.projectBadge}>
          <Text style={styles.projectBadgeLabel}>Active Project</Text>
          <Text style={styles.projectBadgeId} numberOfLines={1}>
            {activeProject?.name ?? projectId}
          </Text>
          <Text style={styles.projectBadgeHint}>Sign out to switch project</Text>
        </View>
      )}

      {/* Nav items */}
      <View style={styles.nav}>
        {NAV_ITEMS.map(({ label, route, icon: Icon, badge }) => (
          <TouchableOpacity
            key={route}
            style={styles.navItem}
            onPress={() => router.push(route as any)}
            activeOpacity={0.7}
          >
            <Icon size={18} color={colors.primary} strokeWidth={2} />
            <Text style={styles.navLabel}>{label}</Text>
            {badge && projectId ? <UnreadBadge kind={badge} /> : null}
          </TouchableOpacity>
        ))}
      </View>

      {/* Footer — user info + sign out. Laid out with marginTop:auto rather than
          absolute positioning, so it can never be clipped off the bottom. */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
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
            {user?.name ? (
              <Text style={styles.userName} numberOfLines={1}>
                {user.name}
              </Text>
            ) : null}
            <Text style={styles.userEmail} numberOfLines={1}>
              {user?.email ?? ""}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={startSignOut}
          activeOpacity={0.7}
        >
          <LogOut size={16} color={colors.destructive} strokeWidth={2} />
          <Text style={styles.signOutText}>Sign out</Text>
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
    width: 38,
    height: 24,
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
  projectBadgeHint: {
    fontSize: 11,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
    marginTop: 4,
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
  navLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.foreground,
  },
  badge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.primaryForeground,
  },
  footer: {
    marginTop: "auto",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.destructive,
  },
  signOutText: {
    fontSize: 13,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.destructive,
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
