import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native"
import { useRouter } from "expo-router"
import { useSession } from "@/src/infrastructure/auth/client"
import { useSignOut } from "../_layout"
import { colors } from "@/src/presentation/shared/colors"

export default function ProfileScreen() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const { startSignOut } = useSignOut()

  // Shows the full-screen spinner (via _layout.tsx SignOutContext), which
  // unmounts every tab screen and its live queries. The actual teardown
  // (collections + SQLite) runs in an effect in AuthGuard, sequenced AFTER
  // that unmount commits — see app/_layout.tsx.
  function handleSignOut() {
    startSignOut()
  }

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-background px-6 pt-16">
      {/* Avatar initial — tap to go back to the project home screen */}
      <TouchableOpacity
        onPress={() => router.navigate("/(tabs)" as any)}
        activeOpacity={0.7}
        className="w-16 h-16 rounded-full bg-primary items-center justify-center mb-4"
      >
        <Text className="text-2xl text-primary-foreground font-sans-semibold">
          {session?.user?.name?.charAt(0).toUpperCase() ?? "?"}
        </Text>
      </TouchableOpacity>

      <Text className="text-2xl font-sans-semibold text-foreground mb-1">
        {session?.user?.name ?? "—"}
      </Text>
      <Text className="text-sm text-muted-foreground mb-12">
        {session?.user?.email ?? ""}
      </Text>

      <TouchableOpacity
        onPress={handleSignOut}
        className="border border-destructive rounded-lg py-3 items-center"
      >
        <Text className="text-destructive font-sans-medium text-sm">
          Sign out
        </Text>
      </TouchableOpacity>
    </View>
  )
}
