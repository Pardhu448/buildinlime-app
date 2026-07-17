import { useState } from "react";
import { ChevronRight, Mail, User, ArrowLeft, Loader2 } from "lucide-react";
import { useRouter, useSearch } from "@tanstack/react-router";
import { authClient } from "../../../infrastructure/auth/client";
import { trpc } from "../../../infrastructure/trpc/lib/trpc-client";
import { LoginCard } from "./LoginCard";

type AuthView = "otp" | "verify";

export function LoginForm() {
  const search = useSearch({ from: '/login' });
  const isSignup = search.mode === "signup";
  const returnTo = search.returnTo || '/';

  const [view, setView] = useState<AuthView>("otp");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);

  const router = useRouter();

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setShowSignupPrompt(false);
    // Sending a code needs the network. Surface a clear message instead of
    // proceeding to the verify view with a misleading "code sent" success state.
    if (!navigator.onLine) {
      setError("You're offline. Connect to the internet to receive a verification code.");
      return;
    }
    setLoading(true);
    try {
      if (isSignup) {
        const { exists } = await trpc.users.checkEmail.query({ email });
        if (exists) {
          setError("An account with this email already exists. Please log in instead.");
          return;
        }
        await trpc.users.register.mutate({ email, name: name.trim() });
      } else {
        const { exists } = await trpc.users.checkEmail.query({ email });
        if (!exists) {
          setError("No account found for this email. Please sign up first.");
          setShowSignupPrompt(true);
          return;
        }
      }

      const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });
      if (sendError) {
        setError(sendError.message || "Failed to send verification code. Please try again.");
        return;
      }
      setSuccessMessage("Verification code sent! Please check your email.");
      setView("verify");
    } catch (err) {
      console.error("Failed to send OTP:", err);
      setError("Failed to send verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error: verifyError } = await authClient.signIn.emailOtp({ email, otp });
      if (verifyError) {
        setError(verifyError.message || "Invalid or expired verification code. Please try again.");
        return;
      }
      if (isSignup && name.trim()) {
        const { error: updateError } = await authClient.updateUser({ name: name.trim() });
        if (updateError) {
          console.error("Failed to save name:", updateError);
        }
      }
      router.navigate({ to: returnTo });
    } catch (err) {
      console.error("Failed to verify OTP:", err);
      setError("Invalid or expired verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError("");
    setSuccessMessage("");
    if (!navigator.onLine) {
      setError("You're offline. Connect to the internet to receive a verification code.");
      return;
    }
    setLoading(true);
    try {
      const { error: resendError } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });
      if (resendError) {
        setError(resendError.message || "Failed to resend verification code. Please try again.");
        return;
      }
      setSuccessMessage("New verification code sent! Please check your email.");
    } catch (err) {
      console.error("Failed to resend OTP:", err);
      setError("Failed to resend verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    setView("otp");
    setOtp("");
    setError("");
    setSuccessMessage("");
  };

  return (
    <LoginCard>
      <div className="p-8">
        {/* Header */}
        <div className="mb-[20px]">
          <h1 className="font-['Inria_Sans',sans-serif] font-bold text-[25.6px] leading-[38.4px] text-foreground tracking-[-0.512px] mb-[6px]">
            {view === "verify"
              ? "Verify your email"
              : isSignup
              ? "Signup with BuildInLime"
              : "Log into BuildInLime"}
          </h1>
          <p
            className="font-['Instrument_Sans',sans-serif] text-[14px] leading-[20px] text-muted-foreground"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {view === "verify"
              ? `We've sent a verification code to ${email}`
              : isSignup
              ? "Create your account to get started."
              : "Enter your email to receive a verification code."}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-[10px]">
              <p className="font-['Instrument_Sans',sans-serif] text-[14px] text-red-600">{error}</p>
            </div>
            {showSignupPrompt && (
              <button
                type="button"
                onClick={() => router.navigate({ to: '/login', search: { mode: 'signup', returnTo } })}
                className="mt-2 w-full bg-white hover:bg-card-surface border border-primary text-primary rounded-[10px] h-[44px] font-['Instrument_Sans',sans-serif] font-medium text-[15px] flex items-center justify-center gap-2 transition-colors"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                <User className="w-4 h-4" />
                Create an account
              </button>
            )}
          </div>
        )}

        {/* Success */}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-[10px]">
            <p className="font-['Instrument_Sans',sans-serif] text-[14px] text-green-700">{successMessage}</p>
          </div>
        )}

        {/* Email / Name form */}
        {view === "otp" && (
          <form onSubmit={handleSendOTP} className="space-y-[20px]">
            {/* Name field — signup only */}
            {isSignup && (
              <div className="space-y-[8px]">
                <label
                  className="font-['Instrument_Sans',sans-serif] font-medium text-[14px] text-black block"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    required
                    className="w-full bg-input-background border border-border rounded-[10px] pl-12 pr-4 py-3 font-['Instrument_Sans',sans-serif] text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    style={{ fontVariationSettings: "'wdth' 100" }}
                  />
                </div>
              </div>
            )}

            {/* Email field */}
            <div className="space-y-[8px]">
              <label
                className="font-['Instrument_Sans',sans-serif] font-medium text-[14px] text-black block"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-input-background border border-border rounded-[10px] pl-12 pr-4 py-3 font-['Instrument_Sans',sans-serif] text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-hover disabled:bg-primary-disabled text-white rounded-[10px] h-[48px] font-['Instrument_Sans',sans-serif] font-medium text-[16px] flex items-center justify-center gap-2 transition-colors"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Send Verification Code
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* OTP verification form */}
        {view === "verify" && (
          <form onSubmit={handleVerifyOTP} className="space-y-[20px]">
            <div className="space-y-[8px]">
              <label
                className="font-['Instrument_Sans',sans-serif] font-medium text-[14px] text-black block"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Verification Code
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtp(val);
                }}
                placeholder="Enter 6-digit code"
                required
                className="w-full bg-input-background border border-border rounded-[10px] px-4 py-3 font-['Instrument_Sans',sans-serif] text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring tracking-[8px] text-center"
                style={{ fontVariationSettings: "'wdth' 100" }}
                maxLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full bg-primary hover:bg-primary-hover disabled:bg-primary-disabled text-white rounded-[10px] h-[48px] font-['Instrument_Sans',sans-serif] font-medium text-[16px] flex items-center justify-center gap-2 transition-colors"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {isSignup ? "Verify & Create Account" : "Verify & Sign In"}
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center">
              <p className="font-['Instrument_Sans',sans-serif] text-[14px] text-muted-foreground">
                Didn't receive the code?{" "}
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={loading}
                  className="text-primary hover:underline font-medium disabled:opacity-50"
                >
                  Resend
                </button>
              </p>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={handleGoBack}
                className="font-['Instrument_Sans',sans-serif] text-[14px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to email
              </button>
            </div>
          </form>
        )}
      </div>
    </LoginCard>
  );
}
