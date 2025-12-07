// backend/utils/mailer.js
const { Resend } = require("resend");

let resendClient = null;

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  // Log env presence (not values)
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
 * Callers: notifyUserOfOfflineMessages in socket.js
 */
async function sendMail({ to, subject, text }) {
  console.log("📧 sendMail called with:", { to, subject });

  const from = process.env.EMAIL_FROM;
  const client = getResendClient();

  if (!client || !from) {
    console.warn("⚠️ [Resend] sendMail aborted: client or FROM not configured");
    return;
  }

  try {
    const result = await client.emails.send({
      from,
      to,
      subject,
      text,
    });

    console.log(
      "✅ [Resend] Notification email sent",
      { to, id: result?.id || null }
    );
  } catch (err) {
    console.warn(
      "⚠️ [Resend] Failed to send email:",
      err?.message || err
    );
  }
}

module.exports = { sendMail };
