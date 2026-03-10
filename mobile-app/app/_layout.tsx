import "../global.css"
import "react-native-gesture-handler"
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  useFonts,
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from "@expo-google-fonts/instrument-sans"
import { Stack, useRouter, useSegments } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { useState, useEffect } from "react"
import { ActivityIndicator, View } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import "react-native-reanimated"

import { useColorScheme } from "@/components/useColorScheme"
import { useSession } from "@/src/infrastructure/auth/client"
import { ProjectProvider } from "@/src/application/context/ProjectContext"

export { ErrorBoundary } from "expo-router"

export const unstable_settings = {
  initialRouteName: "(tabs)",
}

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [loaded, error] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  })

  useEffect(() => {
    if (error) throw error
  }, [error])

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync()
  }, [loaded])

  if (!loaded) return null

  return <RootLayoutNav />
}

function RootLayoutNav() {
  const colorScheme = useColorScheme()
  const [queryClient] = useState(() => new QueryClient())

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <ProjectProvider>
            <AuthGuard />
          </ProjectProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}

function AuthGuard() {
  const { data: session, isPending, error } = useSession()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    // If session check errored (e.g. server unreachable), treat as logged out
    if (isPending) return
    const inAuthGroup = segments[0] === "(auth)"
    if ((!session || error) && !inAuthGroup) {
      router.replace("/(auth)/login")
    } else if (session && !error && inAuthGroup) {
      router.replace("/(tabs)")
    }
  }, [session, isPending, error, segments])

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#976623" />
      </View>
    )
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
    </Stack>
  )
}
