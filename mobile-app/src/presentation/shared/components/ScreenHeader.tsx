import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { useNavigation, DrawerActions } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { colors } from "../colors"

interface ScreenHeaderProps {
  title: string
  subtitle?: string
}

export function ScreenHeader({ title, subtitle }: ScreenHeaderProps) {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.6}
      >
        <View style={styles.hamburger}>
          <View style={styles.line} />
          <View style={[styles.line, styles.lineShort]} />
          <View style={styles.line} />
        </View>
      </TouchableOpacity>

      <View style={styles.titles}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    // paddingTop is applied inline from useSafeAreaInsets().top — the real
    // device inset (notch / dynamic island / status bar), which StatusBar
    // .currentHeight (Android-only, undefined on iOS) got wrong.
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  menuButton: {
    padding: 4,
  },
  hamburger: {
    gap: 4,
    width: 22,
  },
  line: {
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.foreground,
    width: "100%",
  },
  lineShort: {
    width: "65%",
  },
  titles: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
    marginTop: 1,
  },
})
