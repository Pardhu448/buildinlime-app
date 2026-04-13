import { Stack } from "expo-router"

export default function ProjectLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[buildUnitId]"
        getId={({ params }) => params?.buildUnitId}
      />
    </Stack>
  )
}
