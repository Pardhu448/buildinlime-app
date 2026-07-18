import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import type { ReactNode } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Trash2 } from "lucide-react-native"
import { colors } from "@/src/presentation/shared/colors"

interface BackHeaderProps {
  title: string
  onBack: () => void
  /** Trailing content before the delete button — sheet triggers, for instance. */
  actions?: ReactNode
  /**
   * Omitted when the viewer may not delete, which hides the button entirely.
   * Screens with no delete affordance simply never pass it.
   */
  onDelete?: () => void
}

/**
 * The top bar for a PUSHED route: back arrow, title, then actions and delete.
 *
 * Not shared/ScreenHeader — that one opens the drawer from a hamburger and is
 * for the tab-level screens. This is for anything you navigated INTO and back
 * out of: the channel and the task screen, which had the same four styles
 * character-for-character.
 */
export function BackHeader({ title, onBack, actions, onDelete }: BackHeaderProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.6}
      >
        <Text style={styles.backArrow}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      {actions}
      {onDelete && (
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
          style={styles.headerAction}
        >
          <Trash2 size={18} color={colors.mutedForeground} strokeWidth={2} />
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    // paddingTop applied inline from useSafeAreaInsets().top (real device inset).
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  backButton: {
    padding: 4,
    marginRight: 4,
  },
  backArrow: {
    fontSize: 32,
    color: colors.primary,
    fontFamily: "InstrumentSans_400Regular",
    lineHeight: 32,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
    lineHeight: 22,
  },
  headerAction: {
    padding: 6,
  },
})
