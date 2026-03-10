import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native"
import { useRouter } from "expo-router"
import { useSession, authClient, clearAuthCookies } from "@/src/infrastructure/auth/client"

export default function ProfileScreen() {
  const router = useRouter()
  const { data: session, isPending } = useSession()

  async function handleSignOut() {
    console.log(">>> signOut: start")
    const { error } = await authClient.signOut()
    console.log(">>> signOut: done, error:", JSON.stringify(error))
    await clearAuthCookies()
    console.log(">>> signOut: cookies cleared")
    router.replace("/(auth)/login")
  }

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#976623" />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-background px-6 pt-16">
      {/* Avatar initial */}
      <View className="w-16 h-16 rounded-full bg-primary items-center justify-center mb-4">
        <Text className="text-2xl text-primary-foreground font-sans-semibold">
          {session?.user?.name?.charAt(0).toUpperCase() ?? "?"}
        </Text>
      </View>

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
