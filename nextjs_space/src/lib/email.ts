import nodemailer from "nodemailer";

/**
 * lib/email.ts
 * SMTP wrapper para enviar codigos OTP via Gmail.
 * Usa nodemailer (instalado via npm).
 *
 * Hostinger ya tiene configuradas las env vars:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=465
 *   EMAIL_USER=tecnowebiacol@gmail.com
 *   EMAIL_PASS=*** App Password de Gmail
 *   SMTP_FROM=tecnowebiacol@gmail.com
 */

let cachedTransport: nodemailer.Transporter | null = null;

/**
 * Escapa caracteres HTML especiales.  Defensivo: el código OTP es generado
 * server-side con crypto.randomInt así que SIEMPRE son 6 dígitos, pero
 * escapamos igual por si en el futuro el input viniera de otro lugar.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getTransport() {
  if (cachedTransport) return cachedTransport;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      `SMTP no configurado: SMTP_HOST=${!!host} EMAIL_USER=${!!user} EMAIL_PASS=${!!pass}`,
    );
  }

  // 465 = SSL directo, 587 = STARTTLS
  const secure = port === 465;
  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    // Aumentar timeouts para Hostinger
    connectionTimeout: 15000,
    greetingTimeout: 10000,
  });
  return cachedTransport;
}

export async function sendOtpEmail({
  to,
  code,
}: {
  to: string;
  code: string;
}): Promise<{ ok: boolean; error?: string }> {
  const from =
    process.env.SMTP_FROM ??
    process.env.EMAIL_USER ??
    "noreply@controlobra.local";

  // Sanitizar valores que se interpolan en HTML.
  // 'from' y 'to' son del header del email (no se renderizan en HTML body),
  // solo 'code' aparece visible para el usuario y debe estar escapado.
  const safeCode = escapeHtml(code);

  try {
    const transporter = getTransport();
    const info = await transporter.sendMail({
      from: `Control de Obra Pro <${from}>`,
      to,
      subject: "Tu codigo de acceso - Control de Obra Pro",
      text:
        `Hola,\n\n` +
        `Tu codigo de verificacion es: ${code}\n\n` +
        `Este codigo expira en 10 minutos.\n` +
        `Si no lo solicitaste, ignora este mensaje.\n\n` +
        `-- Control de Obra Pro`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #1e293b; margin: 0;">Control de Obra Pro</h1>
          </div>
          <p>Hola,</p>
          <p>Tu codigo de verificacion es:</p>
          <div style="text-align: center; margin: 32px 0;">
            <div style="display: inline-block; background: #f1f5f9; padding: 16px 32px; border-radius: 8px; font-family: monospace; font-size: 32px; letter-spacing: 4px; color: #0f172a; font-weight: bold;">
              ${safeCode}
            </div>
          </div>
          <p style="color: #64748b; font-size: 14px;">Este codigo expira en 10 minutos. Si no lo solicitaste, ignora este mensaje.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">Control de Obra Pro</p>
        </div>
      `,
    });
    console.log(`[email] OTP enviado a ${to}: messageId=${info.messageId}`);
    return { ok: true };
  } catch (e: any) {
    console.error(`[email] Error enviando OTP a ${to}:`, e?.message ?? e);
    return { ok: false, error: e?.message ?? "Email send failed" };
  }
}
