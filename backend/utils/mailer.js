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

  return transporter;
}

async function sendMail({ to, subject, text }) {
  const t = getTransporter();
  if (!t) return; // fail gracefully

  const from = process.env.SMTP_FROM;

  try {
    await t.sendMail({ from, to, subject, text });
    console.log("📧 Notification email sent to", to);
  } catch (err) {
    console.warn("⚠️ Failed to send email:", err.message);
  }
}

module.exports = { sendMail };
