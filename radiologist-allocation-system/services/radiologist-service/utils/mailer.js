let transporter;

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

async function getTransporter() {
  if (transporter) return transporter;

  const nodemailer = await import("nodemailer");
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });

  return transporter;
}

export async function sendOtpEmail({ to, otp, purpose }) {
  const isPasswordReset = purpose === "RESET_PASSWORD";
  const subject = isPasswordReset
    ? "Reset your Radiologist Portal password"
    : "Your Radiologist Portal login OTP";
  const heading = isPasswordReset ? "Password reset request" : "Login verification";
  const action = isPasswordReset ? "reset your password" : "complete your login";
  const text = `Your OTP to ${action} is ${otp}. It expires in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#102033">
      <h2>${heading}</h2>
      <p>Use this OTP to ${action}.</p>
      <div style="font-size:28px;font-weight:700;letter-spacing:6px;background:#ecfeff;border:1px solid #99f6e4;border-radius:14px;padding:18px;text-align:center">${otp}</div>
      <p style="color:#516274">This code expires in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes. If you did not request this, you can ignore this email.</p>
    </div>
  `;

  if (!smtpConfigured()) {
    console.log(`[DEV OTP EMAIL] to=${to} purpose=${purpose} otp=${otp}`);
    return { delivered: false, devFallback: true };
  }

  const client = await getTransporter();
  await client.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });

  return { delivered: true, devFallback: false };
}
