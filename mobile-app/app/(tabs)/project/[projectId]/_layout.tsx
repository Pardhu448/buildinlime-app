import { Stack } from "expo-router"
import { singleParam } from "@/src/presentation/shared/route-params"

export default function ProjectLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="[buildUnitId]"
        dangerouslySingular={(_name, params) => singleParam(params?.buildUnitId)}
      />
    </Stack>
  )
}
