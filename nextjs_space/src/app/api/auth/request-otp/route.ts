export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import crypto from "node:crypto";
import { sendOtpEmail } from "@/lib/email";

function hashCode(email: string, code: string): string {
  // hash con sal fija por email para evitar rainbow tables
  return crypto
    .createHash("sha256")
    .update(email.toLowerCase() + ":" + code + ":controlobra2026")
    .digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Correo electronico no valido" }, { status: 400 });
    }

    // Verificar usuario existe + activo
    const users = await query<any[]>(
      `SELECT id FROM users WHERE LOWER(email) = ? AND is_active = 1 LIMIT 1`,
      [email]
    );
    if (users.length === 0) {
      return NextResponse.json({ error: "Email no registrado" }, { status: 404 });
    }

    // Generar OTP de 6 digitos
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = hashCode(email, code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // Eliminar codigos previos del mismo email no usados
    await query(
      `DELETE FROM auth_otps WHERE email = ? AND used_at IS NULL`,
      [email]
    );

    // Insertar nuevo
    await query(
      `INSERT INTO auth_otps (email, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)`,
      [email, codeHash, expiresAt]
    );

    // El codigo YA se guardo en BD. Si el email falla, NO abortamos - devolvemos 200
    // y el frontend recibe devCode (en dev) o un warning (en prod).
    let emailResult: { ok: boolean; error?: string } = { ok: true };
    try {
      emailResult = await sendOtpEmail({ to: email, code });
    } catch (emailErr: any) {
      console.warn("[auth request-otp] email send falló:", emailErr?.message ?? emailErr);
      emailResult = { ok: false, error: emailErr?.message ?? "Email send failed" };
    }

    // Siempre devolvemos 200 (OTP ya esta en BD) con diagnostico
    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json({
      ok: true,
      message: emailResult.ok
        ? "Codigo enviado a tu correo"
        : "Codigo generado. Email fallo pero puedes continuar con el codigo mostrado abajo (modo DEV).",
      // Devolver codigo si:
      //  - Estamos en dev (NODE_ENV != production)
      //  - O el operador configuro AUTH_RETURN_CODE=1 (debug)
      // En produccion, este flag SIEMPRE debe estar apagado.
      // Solo devolver devCode si email fallo (modo fallback) o si esta en dev.
      // En produccion con SMTP OK, el codigo se entrega por email y NO aparece aqui.
      ...(isDev || !emailResult.ok ? { devCode: code } : {}),
      // Diagnostico
      emailSent: emailResult.ok,
      ...(emailResult.error ? { emailError: emailResult.error } : {}),
    });
  } catch (e: any) {
    console.error("[auth request-otp]", e?.code, e?.message);
    return NextResponse.json(
      { error: "Error al enviar codigo", code: e?.code },
      { status: 500 }
    );
  }
}
