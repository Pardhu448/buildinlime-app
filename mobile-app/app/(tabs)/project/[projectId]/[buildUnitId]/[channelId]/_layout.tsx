import { Stack } from "expo-router"
import { singleParam } from "@/src/presentation/shared/route-params"

export default function ChannelLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[taskId]"
        dangerouslySingular={(_name, params) => singleParam(params?.taskId)}
      />
    </Stack>
  )
}
