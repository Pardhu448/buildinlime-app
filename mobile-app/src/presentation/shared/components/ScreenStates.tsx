import { View, Text, ActivityIndicator, StyleSheet } from "react-native"
import type { LucideIcon } from "lucide-react-native"
import { colors } from "@/src/presentation/shared/colors"

/**
 * The centred loading / empty states shared by the Inbox and My Tasks screens.
 *
 * Scoped to those two deliberately. The projects list and the build-unit index
 * have their own visually similar states with genuinely DIFFERENT values (16px
 * semibold empty text vs 12px regular, a 12px row gap vs 8, different `centered`
 * padding), so folding them in here would restyle them rather than dedupe them.
 * If those screens are ever aligned on purpose, they can adopt this then.
 */
export function LoadingState() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  )
}

interface EmptyStateProps {
  /** Omitted by the "no project selected" states, which are message-only. */
  icon?: LucideIcon
  title?: string
  message: string
}

export function EmptyState({ icon: Icon, title, message }: EmptyStateProps) {
  return (
    <View style={styles.centered}>
      {Icon ? <Icon size={40} color={colors.cardBorder} strokeWidth={1.5} /> : null}
      {title ? <Text style={styles.emptyTitle}>{title}</Text> : null}
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.mutedForeground,
    marginTop: 6,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
    textAlign: "center",
  },
})
