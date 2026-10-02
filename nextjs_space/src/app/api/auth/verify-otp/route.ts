export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { query } from "@/lib/db";
import { signSession, SESSION_COOKIE } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";

function hashCode(email: string, code: string): string {
  return crypto
    .createHash("sha256")
    .update(email.toLowerCase() + ":" + code + ":controlobra2026")
    .digest("hex");
}

export async function POST(req: Request) {
  // Rate limit: 10 intentos por minuto por IP (más permisivo porque
  // el usuario legítimo puede teclear mal varias veces).
  const rl = rateLimit(req, { key: "verify-otp", limit: 10, windowMs: 60_000 });
  if (!rl.allowed) return rl.response!;

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const code = String(body?.otp ?? "").trim();
    if (!email || !/^\s*\d{6}\s*$/.test(code)) {
      return NextResponse.json(
        { error: "Email y codigo de 6 digitos requeridos" },
        { status: 400 },
      );
    }

    // Buscar OTP valido mas reciente
    const otps = await query<any[]>(
      `SELECT id, expires_at, attempts, used_at FROM auth_otps
        WHERE email = ? AND code_hash = ?
        ORDER BY id DESC LIMIT 1`,
      [email, hashCode(email, code)],
    );

    // P0 plan 2026-10-02 (debug): log explicito para diagnosticar 401.
    // Si el codigo no valida, veras en runtime logs por que.
    if (process.env.DEBUG_OTP === "true") {
      const allOtpsForEmail = await query<any[]>(
        `SELECT id, LEFT(code_hash, 16) AS hash_prefix, expires_at, used_at
           FROM auth_otps WHERE email = ? ORDER BY id DESC LIMIT 5`,
        [email],
      );
      console.log(
        "[verify-otp DEBUG]",
        JSON.stringify({
          email,
          receivedCode: code,
          receivedHashPrefix: String(hashCode(email, code)).slice(0, 16),
          matchFound: otps.length,
          recentOtps: allOtpsForEmail,
        }, null, 2),
      );
    }

    if (otps.length === 0) {
      await query(
        `UPDATE auth_otps SET attempts = attempts + 1 WHERE email = ?`,
        [email],
      );
      return NextResponse.json({ error: "Codigo invalido" }, { status: 401 });
    }

    const otp = otps[0];
    // P0 plan 2026-10-02: log explicito para diagnosticar zonas horarias.
    // Como Date.now() es epoch ms UTC, comparamos correctamente.
    const expiresAtMs = new Date(otp.expires_at).getTime();
    const nowMs = Date.now();
    console.log(
      "[verify-otp]",
      JSON.stringify({
        email,
        nowISO: new Date(nowMs).toISOString(),
        expiresAtRaw: String(otp.expires_at),
        expiresAtMs,
        diffMs: expiresAtMs - nowMs,
        usedAtRaw: String(otp.used_at),
        attempts: otp.attempts,
      }),
    );
    if (otp.used_at) {
      return NextResponse.json({ error: "Codigo ya usado" }, { status: 401 });
    }
    if (expiresAtMs < nowMs) {
      return NextResponse.json({ error: "Codigo expirado" }, { status: 401 });
    }
    if (otp.attempts >= 5) {
      return NextResponse.json(
        { error: "Demasiados intentos. Solicita un nuevo codigo." },
        { status: 401 },
      );
    }

    // Marcar como usado
    await query(`UPDATE auth_otps SET used_at = NOW() WHERE id = ?`, [otp.id]);

    // Validar contra whitelist con status='ACTIVE'
    const users = await query<any[]>(
      `SELECT id, email, name, role, area, status, project_id
         FROM users
        WHERE LOWER(email) = ?
        LIMIT 1`,
      [email],
    );
    if (!users.length) {
      return NextResponse.json({ error: "Usuario ya no existe" }, { status: 401 });
    }
    const user = users[0];
    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Tu cuenta ya no esta activa." },
        { status: 401 },
      );
    }

    // Marcar último login
    await query(
      `UPDATE users SET last_login_at = NOW() WHERE id = ?`,
      [user.id],
    );

    // Crear sesión FIRMADA con HMAC (security fix)
    const jar = await cookies();
    jar.set(SESSION_COOKIE, signSession(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    console.error("[auth verify-otp]", e?.code, e?.message);
    return NextResponse.json(
      { error: "Error al verificar" },
      { status: 500 },
    );
  }
}
