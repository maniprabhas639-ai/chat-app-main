// backend/utils/mailer.js
const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
  } = process.env;

  console.log("📧 Mailer env:", {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    hasPass: !!SMTP_PASS,
    SMTP_FROM,
  });

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    console.warn(
      "⚠️ Mailer not configured (missing SMTP_* env vars). Email notifications will be skipped."
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465, // true for 465, false for others
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  // Optional but helpful: verify connection once
  transporter.verify((err, success) => {
    if (err) {
      console.warn("⚠️ SMTP transporter verification failed:", err.message);
    } else {
      console.log("✅ SMTP transporter is ready to send mail");
    }
  });

  return transporter;
}

async function sendMail({ to, subject, text }) {
  console.log("📧 sendMail called with:", { to, subject });

  const t = getTransporter();
  if (!t) {
    console.warn("⚠️ sendMail aborted: transporter not available");
    return;
  }

  const from = process.env.SMTP_FROM;

  try {
    const info = await t.sendMail({ from, to, subject, text });
    console.log("📧 Notification email sent to", to, "messageId:", info.messageId);
  } catch (err) {
    console.warn("⚠️ Failed to send email:", err.message);
  }
}

module.exports = { sendMail };
