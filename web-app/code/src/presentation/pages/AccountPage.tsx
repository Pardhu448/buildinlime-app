import { ArrowLeft, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Sidebar } from "../components/buildInlime";
import { useSession } from "%/infrastructure/auth/client";

/** One label/value row of account detail. */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 py-4 border-b border-card-border last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground break-words">{value}</span>
    </div>
  );
}

/**
 * The third-party services that process user data on our behalf, disclosed for
 * transparency. Keep in sync with the privacy policy's sub-processors list.
 */
const SUB_PROCESSORS: { name: string; purpose: string; location: string }[] = [
  {
    name: "Google Cloud Platform (Google LLC)",
    purpose: "Hosting, database, and file storage",
    location: "asia-south1 — Mumbai, India",
  },
  {
    name: "Resend (Resend, Inc.)",
    purpose: "Transactional email — sign-in codes and messages you send us",
    location: "US East Region — United States",
  },
];

/** One sub-processor row: who they are, what they do, and where they process data. */
function ProcessorRow({
  name,
  purpose,
  location,
}: {
  name: string;
  purpose: string;
  location: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3">
      <span className="text-sm text-foreground">{name}</span>
      <span className="text-xs text-muted-foreground">{purpose}</span>
      <span className="text-xs text-muted-foreground">Location: {location}</span>
    </div>
  );
}

export function AccountPage() {
  const { data: session, isPending } = useSession();
  const user = session?.user;

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
          <h1 className="font-semibold text-[16px] text-foreground">Account</h1>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {isPending ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !user ? (
            <p className="text-sm text-muted-foreground">Not signed in.</p>
          ) : (
            <div className="max-w-2xl">
              <DetailRow label="Name" value={user.name || "—"} />
              <DetailRow label="Email" value={user.email || "—"} />

              {/* Data sub-processors — the third parties that process your data */}
              <div className="mt-8">
                <h2 className="text-sm font-medium text-foreground mb-1">
                  Data sub-processors
                </h2>
                <p className="text-xs text-muted-foreground mb-3">
                  The third-party services we use to operate BuildInLime, and
                  where they process your data.
                </p>
                <div className="rounded-lg border border-card-border divide-y divide-card-border">
                  {SUB_PROCESSORS.map((p) => (
                    <ProcessorRow key={p.name} {...p} />
                  ))}
                </div>
              </div>

              {/* Delete account & data — entry point to the deletion request flow */}
              <div className="mt-8">
                <h2 className="text-sm font-medium text-foreground mb-1">
                  Delete account &amp; data
                </h2>
                <p className="text-xs text-muted-foreground mb-3">
                  Request deletion of your account and the data associated with
                  it. You'll get a copy of your data as part of the request.
                </p>
                <Link
                  to="/delete-account"
                  className="inline-flex items-center gap-2 rounded-md border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete account &amp; data
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default AccountPage;
