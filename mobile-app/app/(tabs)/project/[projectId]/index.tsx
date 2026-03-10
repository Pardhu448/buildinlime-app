import { View, Text, StyleSheet } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { colors } from "@/src/presentation/shared/colors"

export default function BuildUnitsScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Build Units</Text>
      <Text style={styles.subtitle}>Project: {projectId}</Text>
      <Text style={styles.hint}>Build units grid coming in Phase 4.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 26,
    fontFamily: "InstrumentSans_700Bold",
    color: colors.foreground,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.primary,
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
  },
})
