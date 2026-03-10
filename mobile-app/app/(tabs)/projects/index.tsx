import { Text, View } from "react-native"

export default function ProjectsScreen() {
  return (
    <View className="flex-1 bg-background px-6 pt-16">
      <Text className="text-2xl font-sans-semibold text-foreground mb-1">
        Projects
      </Text>
      <Text className="text-sm text-muted-foreground">
        Your projects will appear here.
      </Text>
    </View>
  )
}
