import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Options for sending verification OTP email
 */
interface SendVerificationOtpOptions {
  /** User's email address */
  email: string;
  /** The OTP code to send */
  otp: string;
  /** Type of verification (e.g., "email_verification", "sign_in") */
  type: string;
}

/**
 * Sends a verification OTP email using Resend
 * 
 * @param options - Email, OTP, and type information
 * @returns Promise resolving to the Resend API response
 */
export async function sendVerificationOtp({
  email,
  otp,
  type,
}: SendVerificationOtpOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "BuildInLime <contact@buildinlime.com>",
      to: email,
      subject: `Your verification code to access BuildInLime`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px;">
              <h2 style="color: #333; margin-bottom: 20px;">Verify your email</h2>
              <p style="color: #666; margin-bottom: 20px;">
                Your verification code for ${type} is:
              </p>
              <div style="background: #f0f0f0; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; border-radius: 4px;">
                ${otp}
              </div>
              <p style="color: #999; font-size: 12px; margin-top: 20px;">
                This code will expire in 5 minutes.
              </p>
              <p style="color: #999; font-size: 12px;">
                If you didn't request this code, please ignore this email.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    console.log(`OTP email sent to ${email} (type: ${type})`);
    return { success: true };
  } catch (err) {
    console.error("Failed to send verification OTP:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
