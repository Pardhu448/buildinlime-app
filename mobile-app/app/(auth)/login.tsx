import { useState } from "react"
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import { authClient } from "@/src/infrastructure/auth/client"
import { trpc } from "@/src/infrastructure/trpc/client"
import { colors } from "@/src/presentation/shared/colors"

const brickLogo = require("@/assets/images/brick-logo-brown.png")

type LoginView = "email" | "verify"

export default function LoginScreen() {
  const router = useRouter()
  const [view, setView] = useState<LoginView>("email")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleContinue() {
    setError(null)
    setLoading(true)
    try {
      const result = await trpc.users.checkEmail.query({ email })
      if (!result?.exists) {
        setError("No account found for this email address.")
        setLoading(false)
        return
      }
      const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      })
      if (sendError) {
        setError(sendError.message ?? "Failed to send OTP.")
        setLoading(false)
        return
      }
      setView("verify")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setError(null)
    setLoading(true)
    try {
      const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      })
      if (sendError) setError(sendError.message ?? "Failed to resend OTP.")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  async function handleSignIn() {
    setError(null)
    setLoading(true)
    try {
      const { error: signInError } = await authClient.signIn.emailOtp({ email, otp })
      if (signInError) {
        setError(signInError.message ?? "Invalid code.")
        setLoading(false)
        return
      }
      router.replace("/(tabs)")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
    >
      <View className="flex-1 justify-center px-8">
        {/* Logo mark */}
        <Image
          source={brickLogo}
          resizeMode="contain"
          style={{ width: 60, height: 38, marginBottom: 32 }}
        />

        <Text className="text-2xl font-sans-semibold text-foreground mb-1">
          {view === "email" ? "Sign in to BuildInLime" : "Check your email"}
        </Text>
        <Text className="text-sm text-muted-foreground mb-8">
          {view === "email"
            ? "Enter your email to continue."
            : `We sent a 6-digit code to ${email}`}
        </Text>

        {error && (
          <View className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 mb-6">
            <Text className="text-destructive text-sm">{error}</Text>
          </View>
        )}

        {view === "email" ? (
          <>
            <TextInput
              className="border border-border rounded-lg px-4 py-3 text-sm text-foreground bg-muted mb-4"
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />
            <TouchableOpacity
              onPress={handleContinue}
              disabled={loading || !email.trim()}
              className="bg-primary rounded-lg py-3 items-center"
              style={{ opacity: loading || !email.trim() ? 0.5 : 1 }}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text className="text-primary-foreground font-sans-medium text-sm">
                  Continue
                </Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              className="border border-border rounded-lg px-4 py-3 text-2xl text-center tracking-widest text-foreground bg-muted mb-4"
              placeholder="000000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              editable={!loading}
            />
            <TouchableOpacity
              onPress={handleSignIn}
              disabled={loading || otp.length !== 6}
              className="bg-primary rounded-lg py-3 items-center mb-3"
              style={{ opacity: loading || otp.length !== 6 ? 0.5 : 1 }}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text className="text-primary-foreground font-sans-medium text-sm">
                  Sign In
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleResend}
              disabled={loading}
              className="items-center py-2 mb-2"
            >
              <Text className="text-primary text-sm font-sans-medium">Resend code</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setView("email"); setOtp(""); setError(null) }}
              className="items-center py-2"
            >
              <Text className="text-muted-foreground text-sm">← Back</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}
