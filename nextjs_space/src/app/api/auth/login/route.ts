/**
 * API: GET /api/auth/me  → usuario actual o 401
 * API: POST /api/auth/login { email } → inicia sesión
 *
 * Sin contraseñas: el sistema está pensado para invitaciones o pre-registro.
 * Acepta cualquier email registrado y crea una sesión (cookie).
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "co_session";

export async function GET() {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  try {
    const rows = await query<any[]>(
      `SELECT u.id, u.email, u.name, u.role, u.area
         FROM users u
        WHERE u.id = ? AND u.is_active = 1
        LIMIT 1`,
      [sessionId],
    );
    return NextResponse.json({ user: rows[0] ?? null }, { status: 200 });
  } catch (e: any) {
    console.error("[auth GET] Error:", e?.code, e?.message);
    return NextResponse.json({ error: "No se pudo consultar sesión" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Correo electrónico no válido" },
        { status: 400 },
      );
    }
    const rows = await query<any[]>(
      `SELECT id, email, name, role, area FROM users WHERE LOWER(email) = ? AND is_active = 1 LIMIT 1`,
      [email],
    );
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Usuario no encontrado o inactivo" },
        { status: 404 },
      );
    }
    const user = rows[0];
    const jar = await cookies();
    jar.set(SESSION_COOKIE, user.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 días
    });
    return NextResponse.json({ user }, { status: 200 });
  } catch (e: any) {
    console.error("[auth POST] Error:", e?.code, e?.message);
    return NextResponse.json({ error: "No se pudo iniciar sesión" }, { status: 500 });
  }
}
