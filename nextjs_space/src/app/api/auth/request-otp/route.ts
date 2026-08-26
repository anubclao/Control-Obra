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

    // Enviar por email
    const sent = await sendOtpEmail({ to: email, code });

    // En dev (sin SMTP), el codigo se imprimio en consola del servidor
    return NextResponse.json({
      ok: true,
      message: "Codigo enviado a tu correo",
      // Solo en dev lo devolvemos en la respuesta para testing
      ...(process.env.NODE_ENV !== "production" && sent.ok ? { devCode: code } : {}),
    });
  } catch (e: any) {
    console.error("[auth request-otp]", e?.code, e?.message);
    return NextResponse.json(
      { error: "Error al enviar codigo", code: e?.code },
      { status: 500 }
    );
  }
}
