import { View, FlatList, ActivityIndicator, Text, StyleSheet } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { ScreenHeader } from "@/src/presentation/shared/components/ScreenHeader"
import { BuildUnitCard } from "@/src/presentation/build-units/components/BuildUnitCard"
import { useBuildUnits } from "@/src/presentation/build-units/hooks/useBuildUnits"
import { colors } from "@/src/presentation/shared/colors"

export default function BuildUnitsScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>()
  const router = useRouter()
  const { buildUnits, isLoading } = useBuildUnits(projectId)

  return (
    <View style={styles.container}>
      <ScreenHeader title="Build Units" />
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : buildUnits.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No build units in this project.</Text>
        </View>
      ) : (
        <FlatList
          data={buildUnits}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <BuildUnitCard
                buildUnit={item}
                onPress={() =>
                  router.push(`/(tabs)/project/${projectId}/${item.id}` as any)
                }
              />
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
    textAlign: "center",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  columnWrapper: {
    gap: 12,
  },
  cardWrapper: {
    flex: 1,
  },
})
