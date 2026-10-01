/**
 * lib/api-auth.ts
 *
 * Helpers de autenticación para API routes.
 *
 * Por qué este archivo existe:
 *   - Antes, los endpoints sensibles (DELETE, UPDATE) no verificaban
 *     que el request tuviera una sesión válida. Cualquier visitante
 *     podía borrar proyectos, pagos, contratos, etc.
 *   - Estos helpers deben llamarse AL INICIO de cada handler que
 *     requiera auth.
 *
 * Uso:
 *   export async function DELETE(req: Request) {
 *     const auth = await requireAuth();
 *     if (!auth.ok) return auth.response;
 *     const { userId } = auth;
 *     // ... lógica del endpoint
 *   }
 *
 *   // Para endpoints que solo el Super Admin puede tocar:
 *   const auth = await requireAdmin();
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionCookie, SESSION_COOKIE } from "./session";
import { query } from "./db";
import type { User, Role, AuthorizedUserStatus } from "@/types";

export type AuthSuccess = {
  ok: true;
  userId: string;
  user: Pick<User, "id" | "email" | "name" | "role" | "area">;
};

export type AuthFailure = {
  ok: false;
  response: NextResponse;
};

export type AuthResult = AuthSuccess | AuthFailure;

export type AdminResult = AuthSuccess | AuthFailure;

/**
 * Helper de narrowing: dado el resultado de requireAuth/requireRole/requireAdmin,
 * devuelve el NextResponse si falló la auth, o null si pasó.
 *
 * Por qué existe: el proyecto usa strict:false en tsconfig, lo que desactiva
 * strictNullChecks y hace que TypeScript NO narrowee correctamente los
 * discriminated unions después de `if (!auth.ok)`. Este helper fuerza el
 * narrowing explícito.
 *
 * Uso:
 *   const auth = await requireAuth();
 *   const fail = authFailureResponse(auth);
 *   if (fail) return fail;
 *   // aquí auth.ok === true, TypeScript narrowea correctamente.
 */
export function authFailureResponse(
  result: AuthResult | AdminResult,
): NextResponse | null {
  if (result.ok) return null;
  // Después de `if (result.ok) return null`, TS narrowea a AuthFailure pero
  // con strict:false no se propaga al acceso de `result.response`. Hacemos
  // un cast explícito al tipo narrowed.
  return (result as AuthFailure).response;
}

/**
 * Verifica que el request tenga una cookie de sesión válida y carga el user
 * de la BD. Si la cookie es inválida, expiró o el user ya no está ACTIVE,
 * devuelve 401.
 *
 * IMPORTANTE: usar `status='ACTIVE'` y NO solo `is_active=1` para mantener
 * consistencia con el flujo de autorización (spec admin-user-authorization).
 */
export async function requireAuth(): Promise<AuthResult> {
  const jar = await cookies();
  const cookieValue = jar.get(SESSION_COOKIE)?.value;
  // P1 (seccion 4.4): verifySessionCookie ahora valida firma + exp +
  // fila en user_sessions (no revocada). Si falla cualquiera de las
  // tres, devolvemos 401 con la misma respuesta (anti-enumeracion).
  const session = await verifySessionCookie(cookieValue);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    };
  }
  // Validar contra BD: user existe y está ACTIVE.
  const rows = await query<any[]>(
    `SELECT id, email, name, role, area
       FROM users
      WHERE id = ? AND status = 'ACTIVE'
      LIMIT 1`,
    [session.userId],
  );
  if (!rows.length) {
    // Sesión apuntando a user inválido / suspendido → limpiamos cookie.
    jar.delete(SESSION_COOKIE);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sesión inválida o cuenta inactiva" },
        { status: 401 },
      ),
    };
  }
  return { ok: true, userId: rows[0].id, user: rows[0] };
}

/**
 * Igual que requireAuth pero además verifica role === 'ADMIN'.
 * Usar para: gestión de usuarios, eliminaciones globales, configuración sensible.
 */
export async function requireAdmin(): Promise<AdminResult> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  if (auth.user.role !== "ADMIN") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Acceso restringido: requiere rol ADMIN" },
        { status: 403 },
      ),
    };
  }
  return auth;
}

/**
 * Verifica que el user tenga alguno de los roles dados.
 */
export async function requireRole(...roles: Role[]): Promise<AuthResult> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  if (!roles.includes(auth.user.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `Acceso restringido: requiere uno de los roles [${roles.join(", ")}]`,
        },
        { status: 403 },
      ),
    };
  }
  return auth;
}
