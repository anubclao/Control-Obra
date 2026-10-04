/**
 * /api/auth/dev-login
 *
 * POST: crea una sesion legacy (sin escribir en user_sessions) para
 *       testing local cuando MySQL no es alcanzable.
 *
 * SEGURIDAD:
 *   - Doble guard obligatorio:
 *       (1) process.env.NODE_ENV !== "production"
 *       (2) process.env.DEV_AUTH_BYPASS === "true"
 *   - Si cualquiera falla, devuelve 404 (no 403 — no queremos confirmar
 *     que el endpoint existe a un atacante).
 *   - En produccion (Hostinger), .env NO incluye DEV_AUTH_BYPASS=true
 *     Y ademas NODE_ENV === "production". Doble cerrado.
 *
 * FLUJO:
 *   1. Validar env (doble guard). Si falla -> 404.
 *   2. Rate-limit por IP (30/min).
 *   3. Parsear body: { userId?, email?, name?, role? }.
 *   4. Calcular userId (default "1").
 *   5. Calcular user mock con devMockUser(userId).
 *   6. Firmar cookie con signSession() — formato legacy ${userId}.${sig}.
 *      NO inserta fila en user_sessions.
 *   7. Set cookie httpOnly, maxAge=8h, sameSite=lax, secure=false (dev).
 *   8. Devolver 200 con { ok, user, warning }.
 *
 * POR QUE COOKIE LEGACY:
 *   signSession() (legacy) NO escribe en user_sessions, y verifySessionCookie
 *   acepta ese formato SIN consultar MySQL (ver session.ts lineas 165-176).
 *   Asi el login funciona end-to-end sin BD.
 *
 * LIMITACIONES DOCUMENTADAS:
 *   - Logout llama revokeSession() que intentara UPDATE sobre user_sessions.
 *     Si MySQL no es alcanzable, el logout falla parcialmente pero la cookie
 *     igual se borra del navegador.
 *   - Endpoints que SÍ requieren datos (proyectos, presupuestos, etc.)
 *     seguiran fallando. Este bypass es solo para entrar a la app.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, signSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { devMockUser } from "@/lib/dev-auth";

export async function POST(req: Request) {
  // AC-1 + AC-2: doble guard. Produccion NUNCA expone este endpoint.
  // Ni siquiera devolvemos 403 — usamos 404 para no confirmar existencia.
  if (
    process.env.NODE_ENV === "production" ||
    process.env.DEV_AUTH_BYPASS !== "true"
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Rate-limit igual que el resto de auth.
  const rl = rateLimit(req, {
    key: "dev-login",
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.allowed) return rl.response!;

  try {
    const body = await req.json().catch(() => ({}));
    const rawUserId = String(body?.userId ?? "1").trim();
    // Aceptamos solo caracteres seguros para evitar inyeccion en la cookie.
    const userId = /^[a-zA-Z0-9_-]{1,32}$/.test(rawUserId)
      ? rawUserId
      : "1";

    const user = devMockUser(userId);

    // Cookie legacy: NO toca MySQL. verifySessionCookie la acepta sin
    // consultar user_sessions (ver session.ts formato legacy).
    const cookieValue = signSession(userId);

    const jar = await cookies();
    jar.set(SESSION_COOKIE, cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // dev local
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return NextResponse.json({
      ok: true,
      user,
      warning:
        "DEV-ONLY: sesion legacy sin fila en user_sessions. Solo valido para testing. " +
        "Los endpoints que requieren datos seguiran fallando si MySQL no es alcanzable.",
    });
  } catch (e: any) {
    console.error("[auth dev-login]", e?.code, e?.message);
    return NextResponse.json(
      { error: "Error al crear sesion dev" },
      { status: 500 },
    );
  }
}