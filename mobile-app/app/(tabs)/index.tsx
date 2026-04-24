import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native"
import { useRouter } from "expo-router"
import { useBuildUnits } from "@/src/presentation/build-units/hooks/useBuildUnits"
import { BuildUnitCard } from "@/src/presentation/build-units/components/BuildUnitCard"
import { useProjects } from "@/src/presentation/projects/hooks/useProjects"
import { ProjectCard } from "@/src/presentation/projects/components/ProjectCard"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import { ScreenHeader } from "@/src/presentation/shared/components/ScreenHeader"
import { colors } from "@/src/presentation/shared/colors"

// When a project is selected, Home shows that project's build units.
// When no project is selected (first login), Home is the project picker.
export default function HomeScreen() {
  const { projectId, selectProject } = useProjectContext()

  if (projectId) {
    return <BuildUnitsHome projectId={projectId} />
  }
  return <ProjectPicker onSelect={selectProject} />
}

function BuildUnitsHome({ projectId }: { projectId: string }) {
  const router = useRouter()
  const { buildUnits, isLoading } = useBuildUnits(projectId)
  const { projects } = useProjects()
  const project = projects?.find((p: any) => p.id === projectId)

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={project?.name ?? "Build Units"}
        subtitle="Your build units"
      />
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
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
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

function ProjectPicker({ onSelect }: { onSelect: (id: string) => void }) {
  const { projects, isLoading } = useProjects()

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
                onPress={() => onSelect(item.id)}
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
    backgroundColor: colors.background,
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
