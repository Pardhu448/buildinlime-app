import { View, Text, StyleSheet } from "react-native"
import { ScreenHeader } from "@/src/presentation/shared/components/ScreenHeader"
import { colors } from "@/src/presentation/shared/colors"

export default function InboxScreen() {
  return (
    <View style={styles.container}>
      <ScreenHeader title="Inbox" subtitle="Your @mentions" />
      <View style={styles.body}>
        <Text style={styles.hint}>Coming in Phase 8.</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    fontSize: 14,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
  },
})
