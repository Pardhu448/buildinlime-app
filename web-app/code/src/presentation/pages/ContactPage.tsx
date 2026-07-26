import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Header, HeaderLoggedIn, Footer, PageHeading } from "../components/buildInlime";
import { trpc } from "../../infrastructure/trpc/lib/trpc-client";
import { signOutAndDispose, useRequireAuth } from "../../infrastructure/auth/client";

const inputClass =
  "w-full bg-input-background border border-border rounded-[10px] px-4 py-3 font-['Instrument_Sans',sans-serif] text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export default function ContactPage() {
  const { user } = useRequireAuth();
  const loggedIn = !!user;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSignOut = async () => {
    await signOutAndDispose();
    window.location.href = "/";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!navigator.onLine) {
      setError("You're offline. Connect to the internet to send your message.");
      return;
    }
    setLoading(true);
    try {
      await trpc.contact.send.mutate({
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
      });
      setSent(true);
    } catch (err) {
      console.error("Failed to send contact message:", err);
      setError("Something went wrong sending your message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white flex flex-col items-start min-h-screen">
      {loggedIn ? <HeaderLoggedIn onSignOut={handleSignOut} /> : <Header />}

      <PageHeading
        title="Contact us"
        description="Have a question or want to work with us? Send us a message and we'll be in touch."
      />

      <section className="w-full px-6 lg:px-[120px] py-[20px]">
        <div className="max-w-[788px] mx-auto flex flex-col gap-[16px]">
          <p
            className="font-['Instrument_Sans',sans-serif] text-[16px] leading-[26px] text-black"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            BuildInLime is built by{" "}
            <a
              href="https://barefootprogrammers.in"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              barefootprogrammers.in
            </a>
            . Use the form below to send us a query.
          </p>

          {sent ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-[10px]">
              <p className="font-['Instrument_Sans',sans-serif] text-[15px] text-green-700">
                Thanks for reaching out — your message has been sent. We'll get
                back to you soon.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-[20px] max-w-[520px]">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-[10px]">
                  <p className="font-['Instrument_Sans',sans-serif] text-[14px] text-red-600">
                    {error}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-[8px]">
                <label
                  className="font-['Instrument_Sans',sans-serif] font-medium text-[14px] text-black"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  className={inputClass}
                  style={{ fontVariationSettings: "'wdth' 100" }}
                />
              </div>

              <div className="flex flex-col gap-[8px]">
                <label
                  className="font-['Instrument_Sans',sans-serif] font-medium text-[14px] text-black"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className={inputClass}
                  style={{ fontVariationSettings: "'wdth' 100" }}
                />
              </div>

              <div className="flex flex-col gap-[8px]">
                <label
                  className="font-['Instrument_Sans',sans-serif] font-medium text-[14px] text-black"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we help?"
                  required
                  rows={5}
                  className={inputClass}
                  style={{ fontVariationSettings: "'wdth' 100" }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-hover disabled:bg-primary-disabled text-white rounded-[10px] h-[48px] font-['Instrument_Sans',sans-serif] font-medium text-[16px] flex items-center justify-center gap-2 transition-colors max-w-[520px]"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send message"}
              </button>
            </form>
          )}
        </div>
      </section>

      <Footer compact />
    </div>
  );
}
