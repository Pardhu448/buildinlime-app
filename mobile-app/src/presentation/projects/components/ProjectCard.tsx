import { TouchableOpacity, View, Text, StyleSheet } from "react-native"
import { colors } from "@/src/presentation/shared/colors"
import type { Project } from "../hooks/useProjects"

interface ProjectCardProps {
  project: Project
  onPress: () => void
}

export function ProjectCard({ project, onPress }: ProjectCardProps) {
  const initial = project.name.charAt(0).toUpperCase()

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.iconRow}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>{initial}</Text>
        </View>
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {project.name}
      </Text>
      {project.description ? (
        <Text style={styles.description} numberOfLines={3}>
          {project.description}
        </Text>
      ) : null}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
    // shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  iconRow: {
    marginBottom: 4,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    color: colors.primaryForeground,
    fontSize: 18,
    fontFamily: "InstrumentSans_700Bold",
  },
  name: {
    fontSize: 15,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.foreground,
    lineHeight: 20,
  },
  description: {
    fontSize: 13,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
    lineHeight: 18,
  },
})
