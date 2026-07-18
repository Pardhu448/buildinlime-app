import { useEffect, useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  useWindowDimensions,
} from "react-native"
import type { ReactNode } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Plus, X } from "lucide-react-native"
import type { LucideIcon } from "lucide-react-native"
import { colors } from "@/src/presentation/shared/colors"

// The half-screen bottom sheet behind the channel header buttons, shared by the
// Resources and Tasks sheets. Both had the trigger, badge, backdrop, grabber,
// header and scroll styles character-for-character the same.
//
// The sheet is CONTROLLED — the caller owns `visible`. TasksSheet closes itself
// before navigating to a task, so the open state has to be reachable from
// outside; managing it in here would need a render prop to give it back.

/** Tracks the keyboard only when the sheet asks for it — see BottomSheet. */
function useKeyboardUp(enabled: boolean) {
  const [up, setUp] = useState(false)
  useEffect(() => {
    if (!enabled) return
    const show = Keyboard.addListener("keyboardDidShow", () => setUp(true))
    const hide = Keyboard.addListener("keyboardDidHide", () => setUp(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [enabled])
  return enabled && up
}

interface SheetTriggerProps {
  icon: LucideIcon
  /** Rendered as a badge; hidden at 0, capped at "99+". */
  count: number
  onPress: () => void
}

/** The header button that opens a sheet, with its count badge. */
export function SheetTrigger({ icon: Icon, count, onPress }: SheetTriggerProps) {
  return (
    <TouchableOpacity
      style={styles.trigger}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      activeOpacity={0.7}
    >
      {/* The icon and badge share an explicitly-sized box — see styles.iconBox
          for why the badge cannot simply be absolute inside the padded button. */}
      <View style={styles.iconBox}>
        {/* 20px so the two triggers sitting next to each other match. */}
        <Icon size={20} color={colors.primary} strokeWidth={2} />
        {count > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countText} numberOfLines={1}>
              {count > 99 ? "99+" : count}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

interface BottomSheetProps {
  visible: boolean
  onClose: () => void
  title: string
  /** Rendered between the title and the close button — usually a SheetActionButton. */
  headerAction?: ReactNode
  /**
   * Wrap in a KeyboardAvoidingView and drop the nav-bar inset while the keyboard
   * is up. Only for sheets containing a text input: the sheet is pinned to the
   * bottom half of the screen, exactly where the keyboard opens, so an input
   * would be covered without this. Sheets with no input opt out so their tree
   * stays as it was.
   */
  keyboardAware?: boolean
  children: ReactNode
}

export function BottomSheet({
  visible,
  onClose,
  title,
  headerAction,
  keyboardAware = false,
  children,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const keyboardUp = useKeyboardUp(keyboardAware)

  const body = (
    <>
      {/* Backdrop closes the sheet */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View
        style={[
          styles.sheet,
          // The height is fixed at half the screen, but a keyboard taller than
          // that would leave no room for it — shrink instead of running off the
          // bottom. Only matters when the keyboard can appear.
          keyboardAware && styles.sheetShrink,
          {
            height: height * 0.5,
            // The nav-bar inset must NOT be applied while the keyboard is up: the
            // KeyboardAvoidingView already lifts the sheet clear, and the nav bar
            // is behind the keyboard at that point, so adding its height pushes
            // the sheet a nav-bar's worth too high.
            paddingBottom: keyboardUp ? 0 : insets.bottom,
          },
        ]}
      >
        <View style={styles.grabber} />

        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          {headerAction}
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <X size={18} color={colors.mutedForeground} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {children}
      </View>
    </>
  )

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {keyboardAware ? (
        // "padding" on both platforms, NOT "height": under edge-to-edge the window
        // does not resize for the keyboard, and "height" lifts by shrinking and
        // does not fully unwind on dismiss. Same choice as the channel screen.
        <KeyboardAvoidingView
          style={styles.modalBody}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </Modal>
  )
}

/** The primary action in a sheet header — "Attach", "Add". */
export function SheetActionButton({
  label,
  onPress,
}: {
  label: string
  onPress: () => void
}) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress} activeOpacity={0.7}>
      <Plus size={14} color={colors.primaryForeground} strokeWidth={2.5} />
      <Text style={styles.actionButtonText}>{label}</Text>
    </TouchableOpacity>
  )
}

/** The scrolling body of a sheet. */
export function SheetScroll({
  children,
  persistTaps = false,
}: {
  children: ReactNode
  /** Keep taps working while the keyboard is up — sheets with an input want this. */
  persistTaps?: boolean
}) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps={persistTaps ? "handled" : "never"}
    >
      {children}
    </ScrollView>
  )
}

/** The centred "nothing here yet" line inside a SheetScroll. */
export function SheetEmpty({ children }: { children: ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>
}

const styles = StyleSheet.create({
  trigger: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  // The box the badge is positioned against, sized EXPLICITLY — this is the fix
  // for the two-digit count that kept rendering as "1".
  //
  // Yoga measures an absolutely-positioned child against its parent's CONTENT
  // box. With the badge absolute inside the button itself, that box was just the
  // icon — 20px — so a one-digit badge (17px minWidth) fitted and a two-digit one
  // needed ~21px, got clamped to 20, and the text was squeezed out. It was never
  // wrapping, which is why numberOfLines={1} did not help; and the earlier
  // attempt to "reserve room" with paddingRight made the content box NARROWER,
  // not wider.
  //
  // 30px is sized for the widest badge ("99+", ~27px). The icon sits at the
  // bottom-left and the badge overlaps its top-right corner, as before.
  iconBox: {
    width: 30,
    height: 26,
    justifyContent: "flex-end",
    alignItems: "flex-start",
  },
  // No fixed height, and no lineHeight override — matching DrawerContent's
  // UnreadBadge, which renders two- and three-digit counts correctly because it
  // lets its content size it.
  countBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontSize: 10,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.primaryForeground,
  },
  modalBody: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
  },
  sheetShrink: {
    flexShrink: 1,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cardBorder,
    marginTop: 8,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  sheetTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 12,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.primaryForeground,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 10,
    gap: 8,
  },
  empty: {
    fontSize: 13,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
    textAlign: "center",
    paddingVertical: 24,
  },
})
