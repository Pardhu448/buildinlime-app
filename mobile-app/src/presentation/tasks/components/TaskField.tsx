import { View, Text, StyleSheet } from "react-native"
import type { ReactNode } from "react"
import { colors } from "@/src/presentation/shared/colors"

interface TaskFieldProps {
  label: string
  children: ReactNode
}

/**
 * One labelled block on the task screen — an uppercase caption over its content.
 *
 * Shared by TaskDetailsFields and TaskStatusHistory: both blocks had the caption
 * and spacing styles character-for-character the same, so keeping one copy is
 * what stops them drifting apart.
 */
export function TaskField({ label, children }: TaskFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

/** The primary value line inside a TaskField. */
export function FieldValue({ children }: { children: ReactNode }) {
  return <Text style={styles.fieldValue}>{children}</Text>
}

/** The secondary line inside a TaskField — hints and empty states. */
export function FieldHint({ children }: { children: ReactNode }) {
  return <Text style={styles.fieldHint}>{children}</Text>
}

const styles = StyleSheet.create({
  field: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 14,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.foreground,
  },
  fieldHint: {
    fontSize: 11,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
  },
})
