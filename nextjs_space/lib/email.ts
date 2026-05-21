import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || process.env.EMAIL_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || process.env.EMAIL_USER;
const SMTP_PASS = process.env.SMTP_PASS || process.env.EMAIL_PASS;
const SMTP_FROM = process.env.SMTP_FROM || process.env.EMAIL_FROM || SMTP_USER;

let transporter: any = null;

function getTransporter(): any {
  if (transporter) {
    return transporter;
  }

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP no configurado: faltan SMTP_HOST/SMTP_USER/SMTP_PASS");
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return transporter;
}

export async function sendOtpEmail(email: string, otp: string) {
  const mailer = getTransporter();

  await mailer.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: "Control Obra - Codigo OTP",
    text: `Tu codigo OTP es: ${otp}. Expira en 10 minutos.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
        <h2 style="margin: 0 0 12px;">Control Obra</h2>
        <p style="margin: 0 0 12px;">Tu codigo OTP es:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 2px; margin: 0 0 12px;">${otp}</p>
        <p style="margin: 0;">Este codigo expira en 10 minutos.</p>
      </div>
    `,
  });
}
