import "react-native-get-random-values"
import "../global.css"
import * as ExpoCrypto from "expo-crypto"

// Polyfill crypto.randomUUID — TanStack DB's collection insert calls this internally.
if (typeof crypto !== "undefined" && !crypto.randomUUID) {
  ;(crypto as any).randomUUID = ExpoCrypto.randomUUID
}
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
import { createContext, useContext, useState, useEffect } from "react"
import { ActivityIndicator, View } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import "react-native-reanimated"

import { useColorScheme } from "@/components/useColorScheme"
import { useSession, signOutAndDispose, clearAuthCookies } from "@/src/infrastructure/auth/client"
import { ProjectProvider, useProjectContext } from "@/src/application/context/ProjectContext"
import { waitForLiveQueryRelease } from "@/src/application/collections/live-query-release"

export { ErrorBoundary } from "expo-router"

const SignOutContext = createContext<{ startSignOut: () => void }>({ startSignOut: () => {} })
export const useSignOut = () => useContext(SignOutContext)

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
  const { clearProject } = useProjectContext()
  const segments = useSegments()
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    // If session check errored (e.g. server unreachable), treat as logged out
    if (isPending) return
    const inAuthGroup = segments[0] === "(auth)"
    if ((!session || error) && !inAuthGroup) {
      setIsSigningOut(false)
      router.replace("/(auth)/login")
    } else if (session && !error && inAuthGroup) {
      router.replace("/(tabs)")
    }
  }, [session, isPending, error, segments])

  // Sign-out teardown. This effect runs only AFTER the render that swaps the
  // <Stack> for the spinner has committed — so the (tabs) tree is unmounted by
  // the time we get here. That is necessary but NOT sufficient: the live queries
  // those screens created outlive the unmount until they are GC'd, and tearing
  // down their sources first is what produces "source collection cleaned up while
  // live query depends on it". See waitForLiveQueryRelease.
  useEffect(() => {
    if (!isSigningOut) return
    let cancelled = false
    void (async () => {
      console.log(">>> signOut: start")
      await clearProject()
      if (cancelled) return
      await waitForLiveQueryRelease()
      if (cancelled) return
      // signOut needs cookies to reach the server, so dispose BEFORE clearing.
      await signOutAndDispose()
      if (cancelled) return
      await clearAuthCookies()
      console.log(">>> signOut: complete")
      // AuthGuard's session effect detects !session and navigates to login.
    })()
    return () => {
      cancelled = true
    }
  }, [isSigningOut])

  if (isPending || isSigningOut) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#976623" />
      </View>
    )
  }

  return (
    <SignOutContext.Provider value={{ startSignOut: () => setIsSigningOut(true) }}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
    </SignOutContext.Provider>
  )
}
