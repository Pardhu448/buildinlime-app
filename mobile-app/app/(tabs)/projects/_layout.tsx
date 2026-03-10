import { Stack } from "expo-router"
import { colors } from "@/src/presentation/shared/colors"

export default function ProjectsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: "InstrumentSans_600SemiBold" },
        headerShadowVisible: false,
        headerBackTitle: "Back",
      }}
    />
  )
}
