import { useCallback, useEffect, useState } from "react"
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import type { OfflineTransaction } from "@tanstack/offline-transactions"
import { getOfflineExecutor } from "@/src/infrastructure/offline/executor"
import { colors } from "@/src/presentation/shared/colors"

export default function OfflineDebugScreen() {
  const [outbox, setOutbox] = useState<Array<OfflineTransaction>>([])
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [running, setRunning] = useState(0)
  const [mode, setMode] = useState<string>("?")
  const [storageMsg, setStorageMsg] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const ex = getOfflineExecutor()
      const tx = await ex.peekOutbox()
      setOutbox(tx)
      setPending(ex.getPendingCount())
      setRunning(ex.getRunningCount())
      setOnline(ex.isOnline())
      setMode(ex.mode)
      setStorageMsg(`${ex.storageDiagnostic.code}: ${ex.storageDiagnostic.message}`)
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? String(e))
    }
  }, [])

  // Subscribe to online changes + poll outbox for retry-count / lastError updates.
  useEffect(() => {
    refresh()
    let unsub: (() => void) | undefined
    try {
      unsub = getOfflineExecutor().getOnlineDetector().subscribe(refresh)
    } catch {
      // executor not ready — error will surface via refresh()
    }
    const interval = setInterval(refresh, 1500)
    return () => {
      unsub?.()
      clearInterval(interval)
    }
  }, [refresh])

  const forceDrain = useCallback(() => {
    try {
      getOfflineExecutor().getOnlineDetector().notifyOnline()
      refresh()
    } catch (e: any) {
      Alert.alert("Force drain failed", e?.message ?? String(e))
    }
  }, [refresh])

  const clearOutbox = useCallback(() => {
    Alert.alert(
      "Clear outbox?",
      `This will discard ${outbox.length} pending transaction(s). Optimistic state will not roll back automatically.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await getOfflineExecutor().clearOutbox()
              await refresh()
            } catch (e: any) {
              Alert.alert("Clear failed", e?.message ?? String(e))
            }
          },
        },
      ],
    )
  }, [outbox.length, refresh])

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Offline Debug</Text>

      {error && (
        <View style={[styles.card, styles.errorCard]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Row label="Online" value={online ? "yes" : "no"} valueColor={online ? colors.primary : "#c0392b"} />
        <Row label="Mode" value={mode} />
        <Row label="Pending" value={String(pending)} />
        <Row label="Running" value={String(running)} />
        <Row label="Outbox size" value={String(outbox.length)} />
        <Row label="Storage" value={storageMsg} small />
      </View>

      <View style={styles.actions}>
        <Button label="Refresh" onPress={refresh} />
        <Button label="Force drain" onPress={forceDrain} />
        <Button label="Clear outbox" onPress={clearOutbox} destructive />
      </View>

      <Text style={styles.section}>Outbox ({outbox.length})</Text>

      {outbox.length === 0 && (
        <Text style={styles.empty}>No pending transactions.</Text>
      )}

      {outbox.map((tx) => (
        <View key={tx.id} style={styles.txCard}>
          <Text style={styles.txFn}>{tx.mutationFnName}</Text>
          <Text style={styles.txMeta} numberOfLines={1}>
            id: {tx.id}
          </Text>
          <Row label="Retries" value={String(tx.retryCount)} small />
          <Row
            label="Next attempt"
            value={
              tx.nextAttemptAt
                ? `${Math.max(0, Math.round((tx.nextAttemptAt - Date.now()) / 1000))}s`
                : "—"
            }
            small
          />
          <Row label="Created" value={new Date(tx.createdAt).toLocaleTimeString()} small />
          <Row label="Mutations" value={String(tx.mutations?.length ?? 0)} small />
          {tx.lastError && (
            <View style={styles.txError}>
              <Text style={styles.txErrorName}>{tx.lastError.name}</Text>
              <Text style={styles.txErrorMsg}>{tx.lastError.message}</Text>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  )
}

function Row({
  label,
  value,
  small,
  valueColor,
}: {
  label: string
  value: string
  small?: boolean
  valueColor?: string
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, small && styles.rowLabelSmall]}>{label}</Text>
      <Text
        style={[styles.rowValue, small && styles.rowValueSmall, valueColor && { color: valueColor }]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  )
}

function Button({
  label,
  onPress,
  destructive,
}: {
  label: string
  onPress: () => void
  destructive?: boolean
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.btn, destructive && styles.btnDestructive]}
      activeOpacity={0.7}
    >
      <Text style={[styles.btnText, destructive && styles.btnTextDestructive]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 60, paddingBottom: 40 },
  title: {
    fontSize: 22,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
    marginBottom: 16,
  },
  section: {
    fontSize: 13,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.muted,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorCard: { backgroundColor: "#3b1414" },
  errorText: { color: "#ff7a7a", fontSize: 13 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, gap: 12 },
  rowLabel: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontFamily: "InstrumentSans_500Medium",
  },
  rowLabelSmall: { fontSize: 11 },
  rowValue: {
    fontSize: 13,
    color: colors.foreground,
    fontFamily: "InstrumentSans_500Medium",
    flexShrink: 1,
    textAlign: "right",
  },
  rowValueSmall: { fontSize: 11 },
  actions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  btn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnText: {
    color: colors.primaryForeground,
    fontSize: 13,
    fontFamily: "InstrumentSans_600SemiBold",
  },
  btnDestructive: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#c0392b" },
  btnTextDestructive: { color: "#c0392b" },
  empty: { color: colors.mutedForeground, fontSize: 13, fontStyle: "italic" },
  txCard: {
    backgroundColor: colors.muted,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  txFn: {
    fontSize: 14,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
    marginBottom: 2,
  },
  txMeta: { fontSize: 10, color: colors.mutedForeground, marginBottom: 6 },
  txError: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#3b1414",
  },
  txErrorName: { color: "#ff7a7a", fontSize: 12, fontFamily: "InstrumentSans_600SemiBold" },
  txErrorMsg: { color: "#ffb3b3", fontSize: 11, marginTop: 2 },
})
