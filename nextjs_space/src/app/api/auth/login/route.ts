/**
 * API: GET  /api/auth/me  → usuario actual o 401
 * API: POST /api/auth/login → DESHABILITADO (security fix)
 *
 * HISTORIAL DE SEGURIDAD:
 *   Antes, este endpoint aceptaba { email } y creaba una sesión sin
 *   verificar OTP. Cualquiera podía loguearse como cualquier usuario
 *   simplemente conociendo su email.
 *
 *   AHORA:
 *     - El login SIEMPRE va por /api/auth/request-otp + /api/auth/verify-otp.
 *     - El POST a /api/auth/login devuelve 410 Gone con mensaje explícito.
 *     - El GET sigue funcionando para refrescar la sesión actual.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { verifySessionCookie, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const cookieValue = jar.get(SESSION_COOKIE)?.value;
  const userId = verifySessionCookie(cookieValue);
  if (!userId) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  try {
    // status='ACTIVE' (no solo is_active) para mantener consistencia
    // con el flujo de autorización por Super Admin.
    const rows = await query<any[]>(
      `SELECT id, email, name, role, area
         FROM users
        WHERE id = ? AND status = 'ACTIVE'
        LIMIT 1`,
      [userId],
    );
    return NextResponse.json({ user: rows[0] ?? null }, { status: 200 });
  } catch (e: any) {
    console.error("[auth GET] Error:", e?.code, e?.message);
    return NextResponse.json(
      { error: "No se pudo consultar sesión" },
      { status: 500 },
    );
  }
}

/**
 * POST está deshabilitado por seguridad. Use /api/auth/request-otp seguido
 * de /api/auth/verify-otp para iniciar sesión.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Este endpoint está deshabilitado. Para iniciar sesión use el flujo OTP en /login.",
      disabled: true,
      useFlow: ["/api/auth/request-otp", "/api/auth/verify-otp"],
    },
    { status: 410 }, // 410 Gone — el endpoint existió pero ya no.
  );
}
