/**
 * lib/db.ts
 * Pool MySQL singleton para toda la aplicación.
 * Lee credenciales de variables de entorno (.env.local en dev).
 *
 * Uso:
 *   import { pool } from "@/lib/db";
 *   const [rows] = await pool.query("SELECT * FROM users");
 *
 * IMPORTANTE:
 *  - El pool es singleton entre hot-reloads de Next dev (cache en globalThis).
 *  - Las contraseñas nunca se loggean, sólo el "ok/connectado/no disponible".
 *  - Errores: cada API route usa `console.error('[<modulo> <metodo>]', e?.code, e?.message)`
 *    ANTES de devolver 500 (ver skill `backend-deploy-troubleshooting`).
 */

import mysql, { Pool, PoolOptions, RowDataPacket, ResultSetHeader } from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var __controlObraPool: Pool | undefined;
}

function buildPoolConfig(): PoolOptions {
  const user = process.env.DB_USER ?? "controlobra";
  const password = process.env.DB_PASSWORD ?? "";
  // En produccion, si faltan vars criticas, logueamos y dejamos que el
  // pool se cree con defaults. El primer query fallara ruidosamente y
  // avisara al operador. Esto evita que Next.js aborte el build por
  // no tener las env vars en build time (Hostinger las pasa en runtime).
  if (process.env.NODE_ENV === "production" && !process.env.DB_USER) {
    console.warn("[db] ADVERTENCIA: DB_USER no definido en produccion. Se usara 'controlobra'. Defina DB_USER en el panel de Hostinger.");
  }

  return {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    user,
    password,
    database: process.env.DB_NAME ?? "control_obra",
    connectionLimit: Number(process.env.DB_POOL_SIZE ?? 10),
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    charset: "utf8mb4_unicode_ci",
    dateStrings: true,
    // IMPORTANTE: multipleStatements está desactivado por seguridad (anti SQLi).
    // Si necesitas ejecutarlo (ej. init.sql), abre conexión ad-hoc con mysql.createConnection.
    multipleStatements: false,
    decimalNumbers: false, // DECIMAL → string para no perder precisión
  };
}

function createPool(): Pool {
  const cfg = buildPoolConfig();
  const p = mysql.createPool(cfg);
  // Ping en background; no bloquea el arranque del módulo.
  p.getConnection()
    .then((conn) => {
      conn.release();
      console.log(`[db] ✓ Pool MySQL conectado a ${cfg.host}:${cfg.port}/${cfg.database}`);
    })
    .catch((e: any) => {
      console.error(
        `[db] ✗ No se pudo conectar a MySQL (${cfg.host}:${cfg.port}/${cfg.database})`,
        "\n    Código:", e?.code,
        "\n    Mensaje:", e?.message,
        "\n    Solución: verifica .env (DB_USER, DB_PASSWORD) y que MySQL esté corriendo.",
      );
    });
  return p;
}

/** Pool singleton (sobrevive a hot-reload en dev). */
export const pool: Pool = global.__controlObraPool ?? createPool();
if (process.env.NODE_ENV !== "production") {
  global.__controlObraPool = pool;
}

/**
 * Helper: ejecutar query tipada.
 * Uso: const rows = await query<RowDataPacket[]>("SELECT * FROM users WHERE id = ?", [id]);
 */
export async function query<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params: unknown[] | object = [],
): Promise<T> {
  const [rows] = await pool.query<T>(sql, params as any);
  return rows;
}

/** Helper: transacción con manejo de rollback automático en error. */
export async function transaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    throw e;
  } finally {
    conn.release();
  }
}

/** Sanitiza el id de un body para FORZAR string (evita inyecciones de tipo). */
export function asString(v: unknown, field = "value"): string {
  if (typeof v !== "string") {
    throw new Error(`${field} debe ser un string`);
  }
  return v;
}

export function asNumber(v: unknown, field = "value"): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new Error(`${field} debe ser un número válido`);
  }
  return n;
}

/** Genera un UUID v4 simple (sin dependencia de 'uuid'). */
export function uuid(): string {
  // RFC4122 v4 usando crypto si está disponible (Node 18+).
  const c =
    (globalThis as any).crypto?.randomUUID?.bind((globalThis as any).crypto) ??
    (() => {
      let s = "";
      for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) s += "-";
        else if (i === 14) s += "4";
        else
          s += Math.floor(Math.random() * 16).toString(16);
      }
      // Máscara v4
      return s.slice(0, 14) + "4" + s.slice(15).replace(/[0-9]/, (c2) => {
        return ((parseInt(c2, 10) & 0x3) | 0x8).toString(16);
      });
    });
  return c();
}
