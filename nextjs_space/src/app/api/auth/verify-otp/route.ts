export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { query } from "@/lib/db";

const SESSION_COOKIE = "co_session";

function hashCode(email: string, code: string): string {
  return crypto
    .createHash("sha256")
    .update(email.toLowerCase() + ":" + code + ":controlobra2026")
    .digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const code = String(body?.otp ?? "").trim();
    if (!email || !/^\s*\d{6}\s*$/.test(code)) {
      return NextResponse.json({ error: "Email y codigo de 6 digitos requeridos" }, { status: 400 });
    }

    // Buscar OTP valido mas reciente
    const otps = await query<any[]>(
      `SELECT id, expires_at, attempts, used_at FROM auth_otps
        WHERE email = ? AND code_hash = ?
        ORDER BY id DESC LIMIT 1`,
      [email, hashCode(email, code)]
    );

    if (otps.length === 0) {
      // Incrementar attempts y posiblemente bloquear
      await query(
        `UPDATE auth_otps SET attempts = attempts + 1 WHERE email = ?`,
        [email]
      );
      return NextResponse.json({ error: "Codigo invalido" }, { status: 401 });
    }

    const otp = otps[0];
    if (otp.used_at) {
      return NextResponse.json({ error: "Codigo ya usado" }, { status: 401 });
    }
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Codigo expirado" }, { status: 401 });
    }
    if (otp.attempts >= 5) {
      return NextResponse.json({ error: "Demasiados intentos. Solicita un nuevo codigo." }, { status: 401 });
    }

    // Marcar como usado
    await query(`UPDATE auth_otps SET used_at = NOW() WHERE id = ?`, [otp.id]);

    // Cargar user
    const users = await query<any[]>(
      `SELECT id, email, name, role, area FROM users WHERE LOWER(email) = ? AND is_active = 1 LIMIT 1`,
      [email]
    );
    if (!users.length) {
      return NextResponse.json({ error: "Usuario ya no existe" }, { status: 401 });
    }
    const user = users[0];

    // Crear sesion
    const jar = await cookies();
    jar.set(SESSION_COOKIE, user.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    console.error("[auth verify-otp]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al verificar" }, { status: 500 });
  }
}
