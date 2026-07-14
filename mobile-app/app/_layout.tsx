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

/**
 * Wait until the live queries of the just-unmounted screens have actually been
 * released, before their source collections are torn down.
 *
 * Unmounting a screen does NOT release its live queries synchronously. A
 * useLiveQuery collection is garbage-collected on a timer (TanStack sets
 * gcTime = 1ms for them) and then an idle callback — and until that runs it is
 * still registered as a DEPENDENT of every collection it reads. cleanup() on a
 * source with a live dependent puts that dependent into an error state:
 *
 *   "Source collection 'reads' was manually cleaned up while live query '…'
 *    depends on it. Live queries prevent automatic GC, so this was likely a
 *    manual cleanup() call."
 *
 * The sign-out effect below runs in the tick right after the unmount commit —
 * squarely inside that window. So unmounting first is necessary but not
 * sufficient; we also have to yield past the GC timer and the idle callback that
 * follows it. Worst case this over-waits by a few frames on a screen the user is
 * already leaving.
 */
function waitForLiveQueryRelease(): Promise<void> {
  return new Promise((resolve) => {
    // Past CleanupQueue's microtask + its (1ms) GC timer…
    setTimeout(() => {
      const requestIdle = (
        globalThis as {
          requestIdleCallback?: (
            cb: () => void,
            opts?: { timeout: number },
          ) => void
        }
      ).requestIdleCallback
      // …then past the idle callback that performs the cleanup itself. Ours is
      // queued after theirs, so theirs runs first.
      if (typeof requestIdle === `function`) {
        requestIdle(() => resolve(), { timeout: 200 })
      } else {
        setTimeout(resolve, 0)
      }
    }, 50)
  })
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
