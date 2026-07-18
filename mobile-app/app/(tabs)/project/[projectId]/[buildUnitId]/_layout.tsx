import { Stack } from "expo-router"
import { singleParam } from "@/src/presentation/shared/route-params"

export default function BuildUnitLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[channelId]"
        dangerouslySingular={(_name, params) => singleParam(params?.channelId)}
      />
    </Stack>
  )
}
