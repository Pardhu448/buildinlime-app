import { FlatList, Text, View, ActivityIndicator } from "react-native"
import { useRouter } from "expo-router"
import { useProjects } from "@/src/presentation/projects/hooks/useProjects"
import { ProjectCard } from "@/src/presentation/projects/components/ProjectCard"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import { colors } from "@/src/presentation/shared/colors"

export default function ProjectsScreen() {
  const router = useRouter()
  const { projects, isLoading } = useProjects()
  const { selectProject } = useProjectContext()

  const handleSelectProject = async (projectId: string) => {
    await selectProject(projectId)
    router.push(`/project/${projectId}`)
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingHorizontal: 24, paddingTop: 64 }}>
      <Text style={{ fontSize: 24, fontFamily: "InstrumentSans_600SemiBold", color: colors.foreground, marginBottom: 4 }}>
        Projects
      </Text>
      <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 24 }}>
        Select a project to get started
      </Text>

      {projects && projects.length === 0 ? (
        <Text style={{ fontSize: 14, color: colors.mutedForeground }}>No projects found.</Text>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ gap: 12, paddingBottom: 32 }}
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <ProjectCard project={item} onPress={() => handleSelectProject(item.id)} />
            </View>
          )}
        />
      )}
    </View>
  )
}
