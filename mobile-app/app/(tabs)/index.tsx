import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native"
import { useRouter } from "expo-router"
import { useProjects } from "@/src/presentation/projects/hooks/useProjects"
import { ProjectCard } from "@/src/presentation/projects/components/ProjectCard"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import { ScreenHeader } from "@/src/presentation/shared/components/ScreenHeader"
import { colors } from "@/src/presentation/shared/colors"

export default function HomeScreen() {
  const router = useRouter()
  const { projects, isLoading } = useProjects()
  const { selectProject } = useProjectContext()

  async function handleSelectProject(id: string) {
    await selectProject(id)
    router.push(`/(tabs)/project/${id}` as any)
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Select a Project" subtitle="Tap a project to get started" />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : projects!.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No projects yet.</Text>
          <Text style={styles.emptySubText}>
            Create a project from the web app first.
          </Text>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <ProjectCard
                project={item}
                onPress={() => handleSelectProject(item.id)}
              />
            </View>
          )}
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
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  row: {
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  cardWrapper: {
    flex: 1,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
    textAlign: "center",
    paddingHorizontal: 40,
  },
})
