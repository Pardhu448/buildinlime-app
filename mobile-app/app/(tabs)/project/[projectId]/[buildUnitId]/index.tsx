import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useChannels } from "@/src/presentation/channels/hooks/useChannels"
import { usePropertiesByEntity } from "@/src/presentation/properties/hooks/useProperties"
import { useBuildUnits } from "@/src/presentation/build-units/hooks/useBuildUnits"
import { ChannelCard } from "@/src/presentation/channels/components/ChannelCard"
import { colors } from "@/src/presentation/shared/colors"

export default function ChannelsScreen() {
  const { projectId, buildUnitId } = useLocalSearchParams<{
    projectId: string
    buildUnitId: string
  }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const { buildUnits } = useBuildUnits(projectId)
  const buildUnit = buildUnits.find((b) => b.id === buildUnitId)

  const { channels, isLoading } = useChannels(buildUnitId)
  const channelProperties = usePropertiesByEntity("channel")

  return (
    <View style={styles.container}>
      {/* Inline header with back button */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.navigate("/(tabs)" as any)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.6}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {buildUnit?.name ?? "Build Unit"}
        </Text>
      </View>

      {/* Channels grid — build-unit properties live on its Home card. */}
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
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          renderItem={({ item }) => (
            <ChannelCard
              channel={item}
              properties={channelProperties.get(item.id)}
              onPress={() =>
                router.push(
                  `/(tabs)/project/${projectId}/${buildUnitId}/${item.id}` as any
                )
              }
            />
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
  },
  gap: {
    height: 12,
  },
})
