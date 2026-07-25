import { Resend } from "resend";

// Lazily constructed — the Resend constructor throws when RESEND_API_KEY is
// unset, and this module is reachable from the appRouter (and its tests).
let resend: Resend | null = null;
function getResend(): Resend {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

/** Where account-deletion requests are delivered for manual processing. */
const DELETION_TO = "support@buildinlime.com";

export type DeletionMode = "account-only" | "account-and-collective";

interface SendDeletionRequestEmailOptions {
  /** The requesting user's id (from the server session) */
  userId: string;
  /** The requesting user's email (from the server session) */
  email: string;
  /** The requesting user's name, if any */
  name?: string | null;
  /** Whether to also remove data from the Mozilla Data Collective */
  mode: DeletionMode;
  /** The free-text reason the user gave (may be empty) */
  reason: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Delivers an account-deletion request to support@buildinlime.com so it can be
 * actioned manually. There is no automated backend purge yet (ARCHITECTURE.md
 * §12.11); this email IS the deletion pipeline for now.
 */
export async function sendDeletionRequestEmail({
  userId,
  email,
  name,
  mode,
  reason,
}: SendDeletionRequestEmailOptions): Promise<{ success: boolean; error?: string }> {
  const modeLabel =
    mode === "account-and-collective"
      ? "Delete account + remove data from the Mozilla Data Collective"
      : "Delete account only";

  try {
    const { error } = await getResend().emails.send({
      from: process.env.EMAIL_FROM || "BuildInLime <contact@buildinlime.com>",
      to: DELETION_TO,
      replyTo: email,
      subject: `Account deletion request — ${email}`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 520px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px;">
              <h2 style="color: #333; margin-bottom: 20px;">Account deletion request</h2>
              <p style="color: #666; margin: 0 0 8px;"><strong>User:</strong> ${escapeHtml(name || "—")}</p>
              <p style="color: #666; margin: 0 0 8px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
              <p style="color: #666; margin: 0 0 8px;"><strong>User ID:</strong> ${escapeHtml(userId)}</p>
              <p style="color: #666; margin: 0 0 16px;"><strong>Request:</strong> ${escapeHtml(modeLabel)}</p>
              <p style="color: #666; margin: 0 0 8px;"><strong>Reason:</strong></p>
              <div style="background: #f0f0f0; padding: 15px; border-radius: 4px; color: #333; white-space: pre-wrap;">${escapeHtml(reason || "(none given)")}</div>
              <p style="color: #999; font-size: 12px; margin-top: 20px;">
                Action manually: delete this user's account and data from the backend within 30 days.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend error (deletion request):", error);
      return { success: false, error: error.message };
    }

    console.log(`Deletion request delivered to ${DELETION_TO} for ${email}`);
    return { success: true };
  } catch (err) {
    console.error("Failed to send deletion request:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
