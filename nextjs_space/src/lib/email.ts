/**
 * lib/email.ts
 * Wrapper SMTP para enviar codigos OTP al usuario.
 * Usa el SMTP de Hostinger (SMTP_HOST, SMTP_PORT, EMAIL_USER, EMAIL_PASS).
 */

interface SendOtpOptions {
  to: string;
  code: string;
}

export async function sendOtpEmail({ to, code }: SendOtpOptions): Promise<{ ok: boolean; error?: string }> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const from = process.env.SMTP_FROM ?? user ?? "noreply@controlobra.local";

  if (!host || !user || !pass) {
    console.warn("[email] SMTP no configurado (SMTP_HOST/EMAIL_USER/EMAIL_PASS). Mostrando OTP en consola para dev.");
    console.log(`[email] OTP para ${to}: ${code}`);
    return { ok: true };
  }

  // Implementacion SMTP con TLS via Node stdlib (sin dependencia extra).
  const tls = await import("node:tls");
  const net = await import("node:net");

  return new Promise((resolve) => {
    const socket = tls.connect({ host, port, servername: host }, () => {
      // handshake TLS completado
    });
    let buf = "";
    const commands: string[] = [
      `EHLO controlobra.local`,
      `AUTH LOGIN`,
      Buffer.from(user, "utf8").toString("base64"),
      Buffer.from(pass, "utf8").toString("base64"),
      `MAIL FROM:<${from}>`,
      `RCPT TO:<${to}>`,
      `DATA`,
      [
        `From: Control de Obra Pro <${from}>`,
        `To: <${to}>`,
        `Subject: Tu codigo de acceso - Control de Obra Pro`,
        `MIME-Version: 1.0`,
        `Content-Type: text/plain; charset=UTF-8`,
        ``,
        `Hola,`,
        ``,
        `Tu codigo de verificacion es: ${code}`,
        ``,
        `Este codigo expira en 10 minutos. Si no lo solicitaste, ignora este mensaje.`,
        ``,
        `-- Control de Obra Pro`,
        `.`,
        `QUIT`,
      ].join("\r\n"),
    ];
    let idx = 0;
    socket.on("secureConnect", () => {});
    socket.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      // esperar lineas de respuesta del server (codigo 220/235/250/354)
      while (buf.includes("\r\n") && idx < commands.length) {
        const line = buf.split("\r\n")[0];
        buf = buf.split("\r\n").slice(1).join("\r\n");
        socket.write(commands[idx] + "\r\n");
        idx += 1;
        if (line.startsWith("421")) {
          socket.end();
          return resolve({ ok: false, error: "SMTP rejected: " + line });
        }
      }
    });
    socket.on("end", () => resolve({ ok: true }));
    socket.on("error", (err) => resolve({ ok: false, error: err.message }));
    socket.setTimeout(10000, () => {
      socket.destroy();
      resolve({ ok: false, error: "SMTP timeout" });
    });
  });
}
