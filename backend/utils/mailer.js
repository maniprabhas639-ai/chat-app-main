// backend/utils/mailer.js
const { Resend } = require("resend");

let resendClient = null;

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  console.log("📧 [Resend] Mailer env:", {
    hasApiKey: !!apiKey,
    from,
  });

  if (!apiKey || !from) {
    console.warn(
      "⚠️ [Resend] Missing RESEND_API_KEY or EMAIL_FROM. Email notifications will be skipped."
    );
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

/**
 * Unified email function used by the rest of the app.
 */
async function sendMail({ to, subject, text }) {
  console.log("📧 sendMail called with:", { to, subject });

  const fromEmail = process.env.EMAIL_FROM;           // e.g. chat@maniprabhas.dpdns.org
  const fromName = process.env.EMAIL_FROM_NAME || "Chat Mani"; // optional display name
  const client = getResendClient();

  if (!client || !fromEmail) {
    console.warn("⚠️ [Resend] sendMail aborted: client or FROM not configured");
    return;
  }

  // Use a friendly "From" with display name to reduce spam flags
  const from = `${fromName} <${fromEmail}>`;

  try {
    const { data, error } = await client.emails.send({
      from,
      to,
      subject,
      text,
    });

    if (error) {
      console.warn(
        "⚠️ [Resend] Failed to send email via API:",
        error.message || JSON.stringify(error)
      );
      return;
    }

    console.log("✅ [Resend] Notification email accepted by Resend", {
      to,
      id: data?.id || null,
    });
  } catch (err) {
    console.warn(
      "⚠️ [Resend] Exception while sending email:",
      err?.message || err
    );
  }
}

module.exports = { sendMail };
