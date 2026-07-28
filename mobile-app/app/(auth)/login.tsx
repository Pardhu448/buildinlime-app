import { useState } from "react"
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import { authClient } from "@/src/infrastructure/auth/client"
import { signupUrl, signupBaseUrl } from "@/src/infrastructure/auth/signup-url"
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
  // The address checkEmail found no account for. Held separately from `error`
  // because this is the one failure with somewhere to GO — there is no signup in
  // the mobile app, so the only way forward is the web one, and a plain error
  // string left people at a dead end with no hint that an account could be made
  // at all. Cleared on any edit to the field, so correcting a typo takes the
  // offer away with it.
  const [unregisteredEmail, setUnregisteredEmail] = useState<string | null>(null)

  async function handleContinue() {
    setError(null)
    setUnregisteredEmail(null)
    setLoading(true)
    try {
      const result = await trpc.users.checkEmail.query({ email })
      if (!result?.exists) {
        setUnregisteredEmail(email.trim())
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

  async function handleCreateAccount() {
    const target = unregisteredEmail ?? email
    try {
      await Linking.openURL(signupUrl(target))
    } catch {
      // openURL rejects when no handler can take the URL (no browser installed,
      // or a scheme the OS will not route). Surfacing the address is the useful
      // fallback — it is the one thing the user cannot reconstruct themselves.
      setError(`Could not open the browser. Visit ${signupBaseUrl} to sign up.`)
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

        {/* No account for this address. Not styled as destructive: nothing has
            gone wrong, the person simply has not signed up yet, and the offer
            below is the point of the block rather than the message. Signup is
            web-only for now, so this hands off to the browser. */}
        {unregisteredEmail && view === "email" && (
          <View className="bg-muted border border-border rounded-lg px-4 py-4 mb-6">
            <Text className="text-foreground text-sm font-sans-medium mb-1">
              No account found
            </Text>
            <Text className="text-muted-foreground text-sm mb-4">
              {`We couldn't find an account for ${unregisteredEmail}. You can create one on the web, then come back here to sign in.`}
            </Text>
            <TouchableOpacity
              onPress={handleCreateAccount}
              className="bg-primary rounded-lg py-3 items-center mb-2"
              accessibilityRole="button"
            >
              <Text className="text-primary-foreground font-sans-medium text-sm">
                Create an account
              </Text>
            </TouchableOpacity>
            <Text className="text-muted-foreground text-xs text-center">
              Opens in your browser. Mistyped it? Edit the address above.
            </Text>
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
              // Editing the address retracts the signup offer: it was about the
              // OLD value, and leaving it up next to a changed field would
              // suggest the new one is unregistered too, which has not been
              // checked yet.
              onChangeText={(next) => {
                setEmail(next)
                if (unregisteredEmail) setUnregisteredEmail(null)
              }}
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
