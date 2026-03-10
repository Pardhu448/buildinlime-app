import { useState, useContext } from "react";
import { Eye, EyeOff, Mail, Phone, ArrowLeft, ChevronRight, RefreshCw, ShieldCheck } from "lucide-react";
import { OTPInput, OTPInputContext, REGEXP_ONLY_DIGITS } from "input-otp";
import { Button } from "../components/design-system/Button";
import { Input } from "../components/design-system/Input";
import { Heading, Text } from "../components/design-system/Typography";
import { Logo } from "../components/design-system/Logo";
import { BRICK_PATTERN_URL } from "../components/design-system/BrickPattern";

// ─── OTP Slot ────────────────────────────────────────────────────────────────
function OTPSlot({ index }: { index: number }) {
  const { slots } = useContext(OTPInputContext);
  const slot = slots[index];
  return (
    <div
      className={`
        w-12 h-14 flex items-center justify-center rounded-lg border-2 
        font-['Instrument_Sans',sans-serif] text-xl text-[#1e1e1e] relative
        transition-all duration-200
        ${slot.isActive
          ? "border-[#976623] bg-white shadow-[0_0_0_3px_rgba(151,102,35,0.15)]"
          : slot.char
          ? "border-[#976623] bg-[#fdf8f2]"
          : "border-[#ac7f5e] bg-[#f3f3f5]"
        }
      `}
    >
      {slot.char ?? (
        <span className="text-[#c5c5d0]">·</span>
      )}
      {slot.hasFakeCaret && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-px h-6 bg-[#976623] animate-pulse" />
        </div>
      )}
    </div>
  );
}

// ─── Email / Password Tab ─────────────────────────────────────────────────────
function EmailPasswordForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="Email Address"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      {/* Password field with toggle */}
      <div className="flex flex-col gap-2">
        <label className="font-['Instrument_Sans',sans-serif] font-medium text-sm text-black">
          Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="
              w-full px-4 py-3 pr-12
              bg-[#f3f3f5] border border-[#ac7f5e] rounded-lg
              font-['Instrument_Sans',sans-serif] text-base text-black
              placeholder:text-[#717182]
              focus:outline-none focus:ring-2 focus:ring-[#976623] focus:border-transparent
              transition-all
            "
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#717182] hover:text-[#976623] transition-colors"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {/* Remember me + Forgot password */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer group">
          <div
            onClick={() => setRememberMe(!rememberMe)}
            className={`
              w-4 h-4 rounded border-2 flex items-center justify-center transition-all cursor-pointer
              ${rememberMe ? "bg-[#976623] border-[#976623]" : "border-[#ac7f5e] bg-white"}
            `}
          >
            {rememberMe && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span className="font-['Instrument_Sans',sans-serif] text-sm text-[#1e1e1e]">
            Remember me
          </span>
        </label>
        <button
          type="button"
          className="font-['Instrument_Sans',sans-serif] text-sm text-[#976623] hover:text-[#7d5419] transition-colors"
        >
          Forgot password?
        </button>
      </div>

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <RefreshCw size={16} className="animate-spin" />
            Signing in…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Sign In
            <ChevronRight size={16} />
          </span>
        )}
      </Button>
    </form>
  );
}

// ─── OTP Tab ──────────────────────────────────────────────────────────────────
function OTPForm() {
  const [step, setStep] = useState<"input" | "verify">("input");
  const [contactType, setContactType] = useState<"email" | "mobile">("email");
  const [contact, setContact] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleSendOTP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("verify");
      startCountdown();
    }, 1200);
  };

  const startCountdown = () => {
    setCountdown(30);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleResend = () => {
    if (countdown > 0) return;
    setOtp("");
    startCountdown();
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) return;
    setLoading(true);
    setTimeout(() => setLoading(false), 1200);
  };

  if (step === "verify") {
    return (
      <form onSubmit={handleVerify} className="space-y-6">
        {/* Back */}
        <button
          type="button"
          onClick={() => { setStep("input"); setOtp(""); }}
          className="flex items-center gap-1.5 text-sm font-['Instrument_Sans',sans-serif] text-[#717182] hover:text-[#976623] transition-colors"
        >
          <ArrowLeft size={15} />
          Change {contactType === "email" ? "email" : "mobile number"}
        </button>

        {/* Info */}
        <div className="bg-[#fdf8f2] border border-[#ac7f5e] rounded-lg px-4 py-3 flex items-start gap-3">
          <ShieldCheck size={18} className="text-[#976623] mt-0.5 shrink-0" />
          <div>
            <p className="font-['Instrument_Sans',sans-serif] text-sm text-[#1e1e1e]">
              A 6-digit code was sent to
            </p>
            <p className="font-['Instrument_Sans',sans-serif] text-sm font-semibold text-[#976623] break-all">
              {contact}
            </p>
          </div>
        </div>

        {/* OTP slots */}
        <div className="flex flex-col items-center gap-4">
          <OTPInput
            maxLength={6}
            value={otp}
            onChange={setOtp}
            pattern={REGEXP_ONLY_DIGITS}
            containerClassName="flex gap-2"
            render={({ slots }) => (
              <>
                {slots.map((_, i) => (
                  <OTPSlot key={i} index={i} />
                ))}
              </>
            )}
          />

          {/* Resend */}
          <div className="flex items-center gap-1.5 font-['Instrument_Sans',sans-serif] text-sm">
            <span className="text-[#717182]">Didn't receive it?</span>
            {countdown > 0 ? (
              <span className="text-[#ac7f5e]">Resend in {countdown}s</span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="text-[#976623] hover:text-[#7d5419] font-medium transition-colors"
              >
                Resend code
              </button>
            )}
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={otp.length < 6 || loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <RefreshCw size={16} className="animate-spin" />
              Verifying…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Verify & Sign In
              <ChevronRight size={16} />
            </span>
          )}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendOTP} className="space-y-5">
      {/* Toggle email / mobile */}
      <div className="flex rounded-lg border border-[#ac7f5e] overflow-hidden">
        {(["email", "mobile"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => { setContactType(type); setContact(""); }}
            className={`
              flex-1 flex items-center justify-center gap-2 py-2.5 text-sm 
              font-['Instrument_Sans',sans-serif] font-medium transition-all duration-200
              ${contactType === type
                ? "bg-[#976623] text-white"
                : "bg-white text-[#717182] hover:bg-[#f3f3f5]"
              }
            `}
          >
            {type === "email" ? <Mail size={15} /> : <Phone size={15} />}
            {type === "email" ? "Email OTP" : "Mobile OTP"}
          </button>
        ))}
      </div>

      {contactType === "email" ? (
        <Input
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          required
        />
      ) : (
        <div className="flex flex-col gap-2">
          <label className="font-['Instrument_Sans',sans-serif] font-medium text-sm text-black">
            Mobile Number
          </label>
          <div className="flex gap-2">
            <div className="
              flex items-center justify-center px-3 py-3 w-20 shrink-0
              bg-[#f3f3f5] border border-[#ac7f5e] rounded-lg
              font-['Instrument_Sans',sans-serif] text-sm text-[#1e1e1e]
            ">
              +91
            </div>
            <input
              type="tel"
              placeholder="98765 43210"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              required
              pattern="[0-9]{10}"
              className="
                flex-1 px-4 py-3
                bg-[#f3f3f5] border border-[#ac7f5e] rounded-lg
                font-['Instrument_Sans',sans-serif] text-base text-black
                placeholder:text-[#717182]
                focus:outline-none focus:ring-2 focus:ring-[#976623] focus:border-transparent
                transition-all
              "
            />
          </div>
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={!contact || loading}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <RefreshCw size={16} className="animate-spin" />
            Sending…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Send OTP
            <ChevronRight size={16} />
          </span>
        )}
      </Button>
    </form>
  );
}

// ─── Google Sign-In Tab ───────────────────────────────────────────────────────
function GoogleForm() {
  const [loading, setLoading] = useState(false);

  const handleGoogle = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <Text variant="body" className="text-[#717182]">
          Sign in instantly with your Google account — no password needed.
        </Text>
      </div>

      {/* Google button */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="
          w-full flex items-center justify-center gap-3 px-6 py-3
          bg-white border-2 border-[#ac7f5e] rounded-lg
          font-['Instrument_Sans',sans-serif] text-base text-[#1e1e1e]
          hover:bg-[#fdf8f2] hover:border-[#976623]
          active:bg-[#f5ede0]
          transition-all duration-200
          disabled:opacity-60 disabled:pointer-events-none
          shadow-sm
        "
      >
        {loading ? (
          <RefreshCw size={20} className="text-[#976623] animate-spin" />
        ) : (
          /* Google "G" logo SVG */
          <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M47.532 24.5528C47.532 22.9214 47.3997 21.2811 47.1175 19.6761H24.48V28.9181H37.4434C36.9055 31.8988 35.177 34.5356 32.6461 36.2111V42.2078H40.3801C44.9217 38.0278 47.532 31.8547 47.532 24.5528Z" fill="#4285F4"/>
            <path d="M24.48 48.0016C30.9529 48.0016 36.4116 45.8764 40.3888 42.2078L32.6549 36.2111C30.5031 37.675 27.7252 38.5039 24.4888 38.5039C18.2275 38.5039 12.9187 34.2798 11.0139 28.6006H3.03296V34.7825C7.10718 42.8868 15.4056 48.0016 24.48 48.0016Z" fill="#34A853"/>
            <path d="M11.0051 28.6006C9.99973 25.6199 9.99973 22.3922 11.0051 19.4115V13.2296H3.03298C-0.371021 20.0112 -0.371021 28.0009 3.03298 34.7825L11.0051 28.6006Z" fill="#FBBC04"/>
            <path d="M24.48 9.49932C27.9016 9.44641 31.2086 10.7339 33.6866 13.0973L40.5387 6.24523C36.2 2.17101 30.4414 -0.068932 24.48 0.00161733C15.4055 0.00161733 7.10718 5.11644 3.03296 13.2296L11.005 19.4115C12.901 13.7235 18.2187 9.49932 24.48 9.49932Z" fill="#EA4335"/>
          </svg>
        )}
        <span>{loading ? "Redirecting to Google…" : "Continue with Google"}</span>
      </button>

      {/* Divider */}
      <div className="relative flex items-center gap-3">
        <div className="flex-1 h-px bg-[#e5ddd5]" />
        <span className="font-['Instrument_Sans',sans-serif] text-xs text-[#717182] whitespace-nowrap">
          Secured by Google OAuth 2.0
        </span>
        <div className="flex-1 h-px bg-[#e5ddd5]" />
      </div>

      {/* Trust badges */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: "🔒", label: "Encrypted" },
          { icon: "✓", label: "Verified" },
          { icon: "🛡", label: "Protected" },
        ].map((item) => (
          <div
            key={item.label}
            className="flex flex-col items-center gap-1 py-3 rounded-lg bg-[#f3f3f5] border border-[#e5ddd5]"
          >
            <span className="text-lg">{item.icon}</span>
            <span className="font-['Instrument_Sans',sans-serif] text-xs text-[#717182]">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Login Page ──────────────────────────────────────────────────────────
type TabKey = "password" | "otp" | "google";

const TABS: { key: TabKey; label: string }[] = [
  { key: "password", label: "Email & Password" },
  { key: "otp",      label: "OTP" },
  { key: "google",   label: "Google" },
];

export function LoginPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("password");

  const tabTitle: Record<TabKey, string> = {
    password: "Welcome back",
    otp: "Sign in with OTP",
    google: "One-click sign-in",
  };

  const tabSubtitle: Record<TabKey, string> = {
    password: "Enter your credentials to access your workspace.",
    otp: "We'll send a one-time password to your email or mobile.",
    google: "Use your Google account to sign in securely.",
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Slim top bar */}
      <header className="bg-white border-b border-[#ac7f5e]">
        <div className="max-w-screen-2xl mx-auto px-6 py-2 flex items-center justify-between">
          <a href="/" className="focus:outline-none">
            <Logo size="md" orientation="horizontal" />
          </a>
          <a
            href="/"
            className="flex items-center gap-1.5 font-['Instrument_Sans',sans-serif] text-sm text-[#717182] hover:text-[#976623] transition-colors"
          >
            <ArrowLeft size={15} />
            Back to home
          </a>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex">
        {/* ── Left decorative panel ── */}
        <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 relative overflow-hidden bg-[#1e1e1e] flex-col justify-between p-14">
          {/* Tiled brick background */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `url(${BRICK_PATTERN_URL})`,
              backgroundSize: "160px auto",
              backgroundRepeat: "repeat",
            }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#976623]/60 via-transparent to-[#1e1e1e]/80" />

          {/* Top logo badge */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2">
              <div className="w-2 h-2 rounded-full bg-[#ac7f5e]" />
              <span className="font-['Inria_Sans',sans-serif] font-bold text-white text-sm tracking-wide">
                BuildInLime
              </span>
            </div>
          </div>

          {/* Centre copy */}
          <div className="relative z-10 space-y-6">
            <h2
              className="font-['Inria_Sans',sans-serif] font-bold text-white"
              style={{ fontSize: "2.25rem", lineHeight: "1.2", letterSpacing: "-0.02em" }}
            >
              Build smarter.<br />
              Collaborate faster.<br />
              <span className="text-[#ac7f5e]">Deliver on time.</span>
            </h2>
            <p className="font-['Instrument_Sans',sans-serif] text-white/70 text-base max-w-sm">
              Join thousands of construction professionals who manage their projects on BuildInLime.
            </p>

            {/* Social proof */}
            <div className="flex items-center gap-4 pt-2">
              <div className="flex -space-x-2">
                {["#976623", "#ac7f5e", "#7d5419", "#c49b78"].map((color, i) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-full border-2 border-[#1e1e1e] flex items-center justify-center text-white text-xs font-semibold"
                    style={{ backgroundColor: color }}
                  >
                    {["AR", "SK", "MJ", "PL"][i]}
                  </div>
                ))}
              </div>
              <div>
                <p className="font-['Instrument_Sans',sans-serif] text-white text-sm font-medium">
                  2,400+ teams trust us
                </p>
                <div className="flex items-center gap-0.5 mt-0.5">
                  {[1,2,3,4,5].map((s) => (
                    <svg key={s} width="12" height="12" viewBox="0 0 24 24" fill="#976623">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  ))}
                  <span className="font-['Instrument_Sans',sans-serif] text-white/60 text-xs ml-1">4.9</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom tagline */}
          <div className="relative z-10">
            <p className="font-['Instrument_Sans',sans-serif] text-white/40 text-xs">
              © 2026 BuildInLime. All rights reserved.
            </p>
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
          <div className="w-full max-w-md">
            {/* Card */}
            <div className="bg-white border border-[#e5ddd5] rounded-2xl shadow-[0_8px_40px_rgba(151,102,35,0.10)] overflow-hidden">
              {/* Tab bar */}
              <div className="flex border-b border-[#e5ddd5]">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`
                      flex-1 py-4 text-sm font-['Instrument_Sans',sans-serif] font-medium 
                      transition-all duration-200 relative
                      ${activeTab === tab.key
                        ? "text-[#976623] bg-white"
                        : "text-[#717182] bg-[#f9f7f4] hover:text-[#1e1e1e] hover:bg-[#f3f3f5]"
                      }
                    `}
                  >
                    {tab.label}
                    {activeTab === tab.key && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#976623]" />
                    )}
                  </button>
                ))}
              </div>

              {/* Form body */}
              <div className="p-8">
                {/* Heading */}
                <div className="mb-7">
                  <h1
                    className="font-['Inria_Sans',sans-serif] font-bold text-[#1e1e1e] mb-1.5"
                    style={{ fontSize: "1.6rem", letterSpacing: "-0.02em" }}
                  >
                    {tabTitle[activeTab]}
                  </h1>
                  <p className="font-['Instrument_Sans',sans-serif] text-sm text-[#717182]">
                    {tabSubtitle[activeTab]}
                  </p>
                </div>

                {/* Tab content */}
                {activeTab === "password" && <EmailPasswordForm />}
                {activeTab === "otp"      && <OTPForm />}
                {activeTab === "google"   && <GoogleForm />}

                {/* Divider */}
                {activeTab !== "google" && (
                  <>
                    <div className="relative flex items-center gap-3 my-6">
                      <div className="flex-1 h-px bg-[#e5ddd5]" />
                      <span className="font-['Instrument_Sans',sans-serif] text-xs text-[#717182]">or</span>
                      <div className="flex-1 h-px bg-[#e5ddd5]" />
                    </div>
                    {/* Quick Google link */}
                    <button
                      type="button"
                      onClick={() => setActiveTab("google")}
                      className="
                        w-full flex items-center justify-center gap-3 px-5 py-3
                        bg-white border border-[#e5ddd5] rounded-lg
                        font-['Instrument_Sans',sans-serif] text-sm text-[#1e1e1e]
                        hover:border-[#ac7f5e] hover:bg-[#fdf8f2]
                        transition-all duration-200
                      "
                    >
                      <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M47.532 24.5528C47.532 22.9214 47.3997 21.2811 47.1175 19.6761H24.48V28.9181H37.4434C36.9055 31.8988 35.177 34.5356 32.6461 36.2111V42.2078H40.3801C44.9217 38.0278 47.532 31.8547 47.532 24.5528Z" fill="#4285F4"/>
                        <path d="M24.48 48.0016C30.9529 48.0016 36.4116 45.8764 40.3888 42.2078L32.6549 36.2111C30.5031 37.675 27.7252 38.5039 24.4888 38.5039C18.2275 38.5039 12.9187 34.2798 11.0139 28.6006H3.03296V34.7825C7.10718 42.8868 15.4056 48.0016 24.48 48.0016Z" fill="#34A853"/>
                        <path d="M11.0051 28.6006C9.99973 25.6199 9.99973 22.3922 11.0051 19.4115V13.2296H3.03298C-0.371021 20.0112 -0.371021 28.0009 3.03298 34.7825L11.0051 28.6006Z" fill="#FBBC04"/>
                        <path d="M24.48 9.49932C27.9016 9.44641 31.2086 10.7339 33.6866 13.0973L40.5387 6.24523C36.2 2.17101 30.4414 -0.068932 24.48 0.00161733C15.4055 0.00161733 7.10718 5.11644 3.03296 13.2296L11.005 19.4115C12.901 13.7235 18.2187 9.49932 24.48 9.49932Z" fill="#EA4335"/>
                      </svg>
                      Continue with Google instead
                    </button>
                  </>
                )}
              </div>

              {/* Card footer */}
              <div className="px-8 py-4 bg-[#f9f7f4] border-t border-[#e5ddd5] flex items-center justify-center gap-1">
                <span className="font-['Instrument_Sans',sans-serif] text-sm text-[#717182]">
                  New to BuildInLime?
                </span>
                <button className="font-['Instrument_Sans',sans-serif] text-sm text-[#976623] font-medium hover:text-[#7d5419] transition-colors">
                  Create an account
                </button>
              </div>
            </div>

            {/* Below-card trust line */}
            <p className="text-center font-['Instrument_Sans',sans-serif] text-xs text-[#717182] mt-5">
              By signing in you agree to our{" "}
              <a href="#" className="underline hover:text-[#976623] transition-colors">Terms of Service</a>
              {" & "}
              <a href="#" className="underline hover:text-[#976623] transition-colors">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}