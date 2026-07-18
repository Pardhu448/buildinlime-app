import { View, Text, StyleSheet } from "react-native"
import { TaskField, FieldHint } from "./TaskField"
import { formatDateTime } from "@/src/presentation/shared/lib/datetime"
import { colors } from "@/src/presentation/shared/colors"
import type { Message } from "@buildinlime/domain-types"

interface TaskStatusHistoryProps {
  /** The notes posted with each status change, newest first. */
  history: Message[]
  usersMap: Record<string, string>
}

/**
 * The notes posted with each status change.
 *
 * The message text is shown verbatim: it is the same message the channel shows,
 * and re-parsing our own wording back apart would be a data model made of prose.
 */
export function TaskStatusHistory({ history, usersMap }: TaskStatusHistoryProps) {
  return (
    <TaskField label="Status History">
      {history.length === 0 ? (
        <FieldHint>
          No status changes yet. Notes appear here when the status is changed.
        </FieldHint>
      ) : (
        history.map((m) => (
          <View key={m.id} style={styles.historyRow}>
            <Text style={styles.historyText}>{m.text}</Text>
            <Text style={styles.historyMeta}>
              {usersMap[m.createdby_id] ?? "Unknown"} · {formatDateTime(m.created_at)}
            </Text>
          </View>
        ))
      )}
    </TaskField>
  )
}

const styles = StyleSheet.create({
  historyRow: {
    gap: 3,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.cardSurface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
  },
  historyText: {
    fontSize: 13,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.foreground,
    lineHeight: 18,
  },
  historyMeta: {
    fontSize: 11,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
  },
})
