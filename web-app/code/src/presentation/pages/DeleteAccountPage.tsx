import { useState } from "react";
import { ArrowLeft, Download, Trash2, Loader2 } from "lucide-react";
import { Sidebar } from "../components/buildInlime";
import { useSession } from "%/infrastructure/auth/client";
import { trpc } from "../../infrastructure/trpc/lib/trpc-client";

type DeletionMode = "account-only" | "account-and-collective";

/** Downloads a JSON snapshot of the signed-in user's account details. */
function downloadAccountData(user: { id: string; name?: string; email?: string }) {
  const payload = {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
    },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `buildinlime-data-${user.id}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DeleteAccountPage() {
  const { data: session, isPending } = useSession();
  const user = session?.user;

  const [mode, setMode] = useState<DeletionMode>("account-only");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError("");
    if (!navigator.onLine) {
      setError("You're offline. Connect to the internet to submit your request.");
      return;
    }
    setLoading(true);
    try {
      // There is no automated backend purge yet (ARCHITECTURE.md §12.11): this
      // files the request by email to support@buildinlime.com, where it is
      // actioned manually. Both options export the user's data first.
      await trpc.account.requestDeletion.mutate({ mode, reason: reason.trim() });
      downloadAccountData(user);
      setSubmitted(true);
    } catch (err) {
      console.error("Failed to submit deletion request:", err);
      setError("Something went wrong submitting your request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-white font-['Instrument_Sans',sans-serif]">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top nav */}
        <header className="h-12 bg-white border-b border-card-border flex items-center gap-3 px-6">
          <button
            onClick={() => window.history.back()}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-icon-chip rounded transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-semibold text-[16px] text-foreground">
            Delete account &amp; data
          </h1>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {isPending ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !user ? (
            <p className="text-sm text-muted-foreground">Not signed in.</p>
          ) : submitted ? (
            <div className="max-w-2xl">
              <div className="rounded-lg border border-card-border bg-icon-chip p-4">
                <p className="text-sm font-medium text-foreground mb-1">
                  Deletion request received
                </p>
                <p className="text-sm text-muted-foreground">
                  A copy of your data has been downloaded and your request has
                  been sent to our team at support@buildinlime.com. Your account
                  and relevant data
                  {mode === "account-and-collective"
                    ? ", including data held in the Mozilla Data Collective,"
                    : ""}{" "}
                  will be deleted from our systems within 30 days. We'll process
                  the request manually and email you at {user.email} if we need
                  anything.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
              <p className="text-sm text-muted-foreground">
                Request deletion of your BuildInLime account and the data
                associated with it. You will get a copy of your data as part of
                this request, and your account and data will be deleted within
                30 days. This action cannot be undone.
              </p>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Email */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Email</span>
                <span className="text-sm text-foreground break-words">
                  {user.email || "—"}
                </span>
              </div>

              {/* Deletion mode */}
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-foreground mb-2">
                  What would you like to do?
                </legend>

                <label className="flex items-start gap-3 rounded-lg border border-card-border p-3 cursor-pointer hover:bg-icon-chip transition-colors">
                  <input
                    type="radio"
                    name="deletion-mode"
                    value="account-only"
                    checked={mode === "account-only"}
                    onChange={() => setMode("account-only")}
                    className="mt-1"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm text-foreground">
                      Delete my account and download my data
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Removes your account and its data from BuildInLime. You
                      keep a downloaded copy.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-card-border p-3 cursor-pointer hover:bg-icon-chip transition-colors">
                  <input
                    type="radio"
                    name="deletion-mode"
                    value="account-and-collective"
                    checked={mode === "account-and-collective"}
                    onChange={() => setMode("account-and-collective")}
                    className="mt-1"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm text-foreground">
                      Delete my account, download my data, and delete my data
                      from the Mozilla Data Collective
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Everything above, and additionally requests removal of
                      your data from the Mozilla Data Collective.
                    </span>
                  </span>
                </label>
              </fieldset>

              {/* Reason */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="reason"
                  className="text-sm font-medium text-foreground"
                >
                  Reason for deletion
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  placeholder="Tell us why you're leaving (optional)"
                  className="w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 transition-colors"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete account &amp; data
                </button>
                <button
                  type="button"
                  onClick={() => downloadAccountData(user)}
                  className="inline-flex items-center gap-2 rounded-md border border-card-border px-4 py-2 text-sm font-medium text-foreground hover:bg-icon-chip transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download my data
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

export default DeleteAccountPage;
