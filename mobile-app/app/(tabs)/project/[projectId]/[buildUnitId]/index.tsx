import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  StatusBar,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useChannels } from "@/src/presentation/channels/hooks/useChannels"
import { useProperties } from "@/src/presentation/properties/hooks/useProperties"
import { useBuildUnits } from "@/src/presentation/build-units/hooks/useBuildUnits"
import { ChannelCard } from "@/src/presentation/channels/components/ChannelCard"
import { PropertyPill } from "@/src/presentation/properties/components/PropertyPill"
import { colors } from "@/src/presentation/shared/colors"

export default function ChannelsScreen() {
  const { projectId, buildUnitId } = useLocalSearchParams<{
    projectId: string
    buildUnitId: string
  }>()
  const router = useRouter()

  const { buildUnits } = useBuildUnits()
  const buildUnit = buildUnits.find((b) => b.id === buildUnitId)

  const { channels, isLoading } = useChannels(buildUnitId)
  const { properties } = useProperties(buildUnitId)

  // Only show properties tagged to this build unit entity
  const buildUnitProperties = properties.filter((p) => p.entity === "buildUnit")

  return (
    <View style={styles.container}>
      {/* Inline header with back button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.6}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {buildUnit?.name ?? "Build Unit"}
        </Text>
      </View>

      {/* Property pills row */}
      {buildUnitProperties.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsContainer}
          style={styles.pillsScroll}
        >
          {buildUnitProperties.map((prop) => (
            <PropertyPill key={prop.id} property={prop} />
          ))}
        </ScrollView>
      )}

      {/* Channels grid */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : channels.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No channels in this build unit.</Text>
        </View>
      ) : (
        <FlatList
          data={channels}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <ChannelCard
                channel={item}
                onPress={() =>
                  router.push(
                    `/(tabs)/project/${projectId}/${buildUnitId}/${item.id}` as any
                  )
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: (StatusBar.currentHeight ?? 44) + 8,
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
  pillsScroll: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pillsContainer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
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
