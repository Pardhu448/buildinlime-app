import { Resend } from "resend";

// Constructed lazily inside the sender rather than at module load: the Resend
// constructor throws when RESEND_API_KEY is unset, and this module is pulled in
// by the appRouter (and thus by tests that import it without a mail key).
let resend: Resend | null = null;
function getResend(): Resend {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

/** Where contact-form submissions are delivered. */
const CONTACT_TO = "parthasarathi.edupally@barefootprogrammers.in";

interface SendContactEmailOptions {
  /** Submitter's name */
  name: string;
  /** Submitter's email — used as reply-to so a reply goes straight back to them */
  email: string;
  /** The message body */
  message: string;
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
 * Delivers a contact-form submission to the BuildInLime maintainers via Resend.
 * `replyTo` is the submitter so a reply from the inbox reaches them directly,
 * while `from` stays on the verified sending domain.
 */
export async function sendContactEmail({
  name,
  email,
  message,
}: SendContactEmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await getResend().emails.send({
      from: process.env.EMAIL_FROM || "BuildInLime <contact@buildinlime.com>",
      to: CONTACT_TO,
      replyTo: email,
      subject: `New contact-form message from ${name}`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 520px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px;">
              <h2 style="color: #333; margin-bottom: 20px;">New contact-form message</h2>
              <p style="color: #666; margin: 0 0 8px;"><strong>Name:</strong> ${escapeHtml(name)}</p>
              <p style="color: #666; margin: 0 0 20px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
              <div style="background: #f0f0f0; padding: 15px; border-radius: 4px; color: #333; white-space: pre-wrap;">${escapeHtml(message)}</div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend error (contact):", error);
      return { success: false, error: error.message };
    }

    // CONTACT_TO is our own config, not PII; the sender's address is, and this runs
    // server-side in production. Drop it from the log line.
    console.log(`Contact email delivered to ${CONTACT_TO}`);
    return { success: true };
  } catch (err) {
    console.error("Failed to send contact email:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
