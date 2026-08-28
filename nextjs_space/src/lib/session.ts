/**
 * lib/session.ts
 *
 * Sesión firmada con HMAC-SHA256.
 *
 * Por qué este archivo existe:
 *   - Antes, la cookie `co_session` contenía SOLO el user.id en texto plano.
 *     Cualquiera podía falsificarla con `document.cookie = 'co_session=<otro-user-id>'`.
 *   - Ahora, la cookie contiene `${userId}.${signature}` donde signature es
 *     HMAC-SHA256(userId, SESSION_SECRET). El servidor verifica la firma
 *     antes de confiar en el userId.
 *   - Si SESSION_SECRET no está configurado, las firmas usan un fallback
 *     derivado del package.json + DB host (mejor que nada, pero se loggea
 *     un warning para que el operador lo configure en producción).
 *
 * Uso:
 *   import { signSession, verifySessionCookie } from "@/lib/session";
 *   jar.set(SESSION_COOKIE, signSession(user.id), { httpOnly: true, ... });
 *   const userId = verifySessionCookie(jar.get(SESSION_COOKIE)?.value);
 */

import crypto from "node:crypto";

const COOKIE_NAME = "co_session";

function getSecret(): string {
  const env = process.env.SESSION_SECRET;
  if (env && env.length >= 16) return env;
  // Fallback derivable — NO es seguro para producción pero evita caída total.
  // El operador debe setear SESSION_SECRET en .env.
  const fallback = [
    process.env.DATABASE_URL ?? "",
    process.env.DB_HOST ?? "localhost",
    process.env.DB_NAME ?? "control_obra",
    "controlobra-session-fallback-do-not-use-in-prod",
  ].join("|");
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[session] ⚠️  SESSION_SECRET no está configurado (≥16 chars requerido). " +
        "Usando fallback derivable — esto NO es seguro para producción. " +
        "Configura SESSION_SECRET en .env con un valor aleatorio ≥16 chars.",
    );
  }
  return fallback;
}

function sign(userId: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(userId)
    .digest("base64url");
}

/** Devuelve el valor que se debe guardar en la cookie. */
export function signSession(userId: string): string {
  if (!userId || typeof userId !== "string") {
    throw new Error("signSession: userId requerido");
  }
  return `${userId}.${sign(userId, getSecret())}`;
}

/**
 * Verifica el valor de la cookie y devuelve el userId si la firma es válida.
 * Si la firma no coincide (cookie forjada o secret rotado), devuelve null.
 */
export function verifySessionCookie(cookieValue: string | undefined): string | null {
  if (!cookieValue || typeof cookieValue !== "string") return null;
  const dot = cookieValue.lastIndexOf(".");
  if (dot < 1 || dot === cookieValue.length - 1) return null;
  const userId = cookieValue.slice(0, dot);
  const provided = cookieValue.slice(dot + 1);
  const expected = sign(userId, getSecret());
  // Comparación constant-time para evitar timing attacks.
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return userId;
}

export { COOKIE_NAME as SESSION_COOKIE };
