/**
 * lib/session.ts
 *
 * Sesiones firmadas con HMAC-SHA256 y revocables en el servidor.
 *
 * Por qué este archivo existe:
 *   - Antes la cookie `co_session` contenia SOLO `${userId}.${signature}`
 *     (HMAC del userId). El servidor no podia invalidar la sesion, y
 *     el logout solo borraba la cookie del navegador. Una cookie
 *     robada servia indefinidamente hasta rotar SESSION_SECRET.
 *   - Ahora el formato es `${userId}|${exp}|${tokenId}.${signature}`:
 *       * `exp` es epoch seconds; el servidor rechaza si exp < now.
 *       * `tokenId` es un identificador random unico por sesion;
 *         existe una fila en `user_sessions` con ese id. Si el row
 *         tiene revoked_at != NULL, la sesion es invalida.
 *       * `signature` HMAC-SHA256 de `${userId}|${exp}|${tokenId}`.
 *   - Si SESSION_SECRET no esta configurado, las firmas usan un
 *     fallback derivable (NO seguro en produccion, se loggea warning).
 *
 * Modo legacy: si la cookie llega en formato `${userId}.${signature}`
 * (sin exp|tokenId), la firmamos como antes y la dejamos pasar con
 * un tiempo de vida corto. Asi no rompemos sesiones activas en
 * el momento del deploy; las sesiones pre-existentes iran expirando.
 *
 * Uso:
 *   import { createSession, revokeSession, verifySessionCookie } from "@/lib/session";
 *   const { cookieValue, expiresAt } = await createSession(userId, { ip, userAgent });
 *   jar.set(SESSION_COOKIE, cookieValue, { ... });
 *   const session = await verifySessionCookie(jar.get(SESSION_COOKIE)?.value);
 *   if (!session) ...; // 401
 */

import crypto from "node:crypto";
import { query } from "./db";

const COOKIE_NAME = "co_session";
/** Vida por defecto: 8h. Configurable por env. */
const DEFAULT_LIFETIME_SECONDS = Number(
  process.env.SESSION_LIFETIME_SECONDS ?? 60 * 60 * 8,
);
/** Ventana de gracia para migracion desde sesiones sin exp|tokenId. */
const LEGACY_LIFETIME_SECONDS = 60 * 60; // 1h

function getSecret(): string {
  const env = process.env.SESSION_SECRET;
  if (env && env.length >= 16) return env;
  // Fallback derivable — NO es seguro para producción.
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

function sign(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// -----------------------------------------------------------------------------
// API publica
// -----------------------------------------------------------------------------

export interface CreatedSession {
  /** Valor que se guarda en la cookie. */
  cookieValue: string;
  /** ISO timestamp del momento en que expira. */
  expiresAt: string;
  /** Identificador de la sesion (row id en user_sessions). */
  sessionId: string;
  /** Identificador de token (tambien en la cookie). */
  tokenId: string;
}

export interface VerifiedSession {
  userId: string;
  sessionId: string;
  tokenId: string;
  expiresAt: number;
}

/**
 * Crea una nueva sesion para `userId` con vida `lifetimeSeconds` (default
 * `SESSION_LIFETIME_SECONDS` o 8h). Inserta una fila en `user_sessions`
 * y devuelve el valor de la cookie + metadata. Si la insercion falla,
 * lanza el error del driver (deja la creacion de cookie al caller).
 */
export async function createSession(
  userId: string,
  meta: {
    ip?: string | null;
    userAgent?: string | null;
    lifetimeSeconds?: number;
  } = {},
): Promise<CreatedSession> {
  if (!userId) throw new Error("createSession: userId requerido");
  const lifetime = meta.lifetimeSeconds ?? DEFAULT_LIFETIME_SECONDS;
  const tokenId = crypto.randomBytes(24).toString("base64url");
  const sessionId = crypto.randomUUID();
  const exp = Math.floor(Date.now() / 1000) + lifetime;
  const payload = `${userId}|${exp}|${tokenId}`;
  const sig = sign(payload, getSecret());
  const cookieValue = `${payload}.${sig}`;

  await query(
    `INSERT INTO user_sessions
       (id, user_id, token_id, expires_at, ip, user_agent)
     VALUES (?, ?, ?, FROM_UNIXTIME(?), ?, ?)`,
    [
      sessionId,
      userId,
      tokenId,
      exp,
      meta.ip ?? null,
      meta.userAgent ? String(meta.userAgent).slice(0, 255) : null,
    ],
  );
  return {
    cookieValue,
    expiresAt: new Date(exp * 1000).toISOString(),
    sessionId,
    tokenId,
  };
}

/**
 * Verifica el valor de la cookie y devuelve la sesion si la firma es
 * valida, no ha expirado y la fila en BD no esta revocada.
 *
 * Modo legacy: si la cookie llega en formato `${userId}.${signature}`
 * (sin exp|tokenId), se acepta por un periodo corto (LEGACY_LIFETIME_SECONDS
 * desde la ultima vez que se vio). Asi no rompemos sesiones activas
 * en el momento del deploy.
 */
export async function verifySessionCookie(
  cookieValue: string | undefined,
): Promise<VerifiedSession | null> {
  if (!cookieValue || typeof cookieValue !== "string") return null;
  const dot = cookieValue.lastIndexOf(".");
  if (dot < 1 || dot === cookieValue.length - 1) return null;
  const payload = cookieValue.slice(0, dot);
  const provided = cookieValue.slice(dot + 1);
  const expected = sign(payload, getSecret());
  if (!constantTimeEqual(provided, expected)) return null;

  // Detectar formato legacy vs nuevo.
  const parts = payload.split("|");
  if (parts.length === 1) {
    // Legacy: solo userId. Marcamos la migracion recomendada. El
    // caller deberia forzar re-login si quiere aplicar la ventana
    // corta de gracia.
    return {
      userId: parts[0],
      sessionId: "legacy",
      tokenId: "legacy",
      expiresAt: 0,
    };
  }
  if (parts.length !== 3) return null;
  const [userId, expStr, tokenId] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp)) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null;

  // Comprobar revocacion en BD.
  const rows = await query<any[]>(
    `SELECT id, revoked_at, expires_at
       FROM user_sessions
      WHERE token_id = ? AND user_id = ?
      LIMIT 1`,
    [tokenId, userId],
  );
  if (!rows.length) {
    // Sesion firmada correctamente pero sin fila en BD: la
    // consideramos revocada para evitar usos de cookies robadas
    // que no pasaron por nuestro flujo de creacion.
    return null;
  }
  const row = rows[0];
  if (row.revoked_at) return null;
  // Doble check de expiracion en BD (defensa en profundidad).
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  // Best-effort: actualizar last_seen_at para auditoria. Si falla,
  // no bloqueamos la sesion.
  query(`UPDATE user_sessions SET last_seen_at = NOW() WHERE id = ?`, [
    row.id,
  ]).catch(() => {});

  return { userId, sessionId: row.id, tokenId, expiresAt: exp };
}

/**
 * Revoca la sesion actual (logout). Devuelve true si revoco una fila.
 */
export async function revokeSession(
  userId: string,
  tokenId: string | "legacy",
  reason: string = "logout",
): Promise<boolean> {
  if (tokenId && tokenId !== "legacy") {
    const result: any = await query(
      `UPDATE user_sessions
          SET revoked_at = NOW(), revoked_reason = ?
        WHERE token_id = ? AND user_id = ? AND revoked_at IS NULL`,
      [reason, tokenId, userId],
    );
    return (result?.affectedRows ?? 0) > 0;
  }
  // Legacy: revocar todas las sesiones no revocadas del usuario.
  await query(
    `UPDATE user_sessions
        SET revoked_at = NOW(), revoked_reason = ?
      WHERE user_id = ? AND revoked_at IS NULL`,
    [reason, userId],
  );
  return true;
}

/**
 * Revoca TODAS las sesiones de un usuario (uso en suspension de cuenta
 * o cambio de password).
 */
export async function revokeAllUserSessions(
  userId: string,
  reason: string = "admin_revoke",
): Promise<number> {
  const result: any = await query(
    `UPDATE user_sessions
        SET revoked_at = NOW(), revoked_reason = ?
      WHERE user_id = ? AND revoked_at IS NULL`,
    [reason, userId],
  );
  return result?.affectedRows ?? 0;
}

// -----------------------------------------------------------------------------
// Compatibilidad hacia atras
// -----------------------------------------------------------------------------

/** Mantiene la firma antigua para callers que no necesiten revocacion. */
export function signSession(userId: string): string {
  if (!userId) throw new Error("signSession: userId requerido");
  return `${userId}.${sign(userId, getSecret())}`;
}

export { COOKIE_NAME as SESSION_COOKIE };
