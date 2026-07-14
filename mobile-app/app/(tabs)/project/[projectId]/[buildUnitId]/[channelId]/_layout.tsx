import { Stack } from "expo-router"

export default function ChannelLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[taskId]"
        dangerouslySingular={(_name, params) => params?.taskId}
      />
    </Stack>
  )
}
