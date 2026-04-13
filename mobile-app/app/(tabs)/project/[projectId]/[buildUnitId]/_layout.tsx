import { Stack } from "expo-router"

export default function BuildUnitLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[channelId]"
        getId={({ params }) => params?.channelId}
      />
    </Stack>
  )
}
