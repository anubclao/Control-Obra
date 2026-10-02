// filepath: src/lib/document-generator/log.ts
// Persistencia del log de generación de documentos (tabla
// document_generation_log, ver migración 006).

import { query } from "@/lib/db";
import type { PoolConnection } from "mysql2/promise";
import type { DocumentEntity, DocumentTemplateId } from "@/types/documents";

export type LogStatus = "OK" | "ERROR";

export interface LogEntryInput {
  entity: DocumentEntity;
  entityId: string;
  templateId: DocumentTemplateId;
  fileName: string;
  sharepointPath: string;
  webUrl: string;
  status: LogStatus;
  errorCode?: string | null;
  durationMs: number;
  userId?: string | null;
  /** F4: IP del cliente (X-Forwarded-For / X-Real-IP). */
  ip?: string | null;
  /** F4: User-Agent del cliente. Truncar a 255 chars. */
  userAgent?: string | null;
  /** F4: Número de intentos de subida (post-retry). */
  attempts?: number | null;
  /** F4: Versión del template inferida del nombre de archivo. */
  templateVersion?: string | null;
}

export interface DocumentGenerationLogEntry {
  id: string;
  entity: DocumentEntity;
  entityId: string;
  templateId: DocumentTemplateId;
  fileName: string;
  sharepointPath: string;
  webUrl: string;
  status: LogStatus;
  errorCode: string | null;
  durationMs: number;
  userId: string | null;
  ip: string | null;
  userAgent: string | null;
  attempts: number | null;
  templateVersion: string | null;
  createdAt: string;
}

/**
 * Inserta una entrada en document_generation_log. No falla la operación
 * principal si el log falla (se loggea en consola).
 */
export async function logGeneration(
  entry: LogEntryInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    // Truncar userAgent a 255 chars para no romper el VARCHAR(255).
    const ua = entry.userAgent ? String(entry.userAgent).slice(0, 255) : null;
    const attempts =
      typeof entry.attempts === "number" && entry.attempts > 0
        ? Math.min(255, entry.attempts)
        : null;
    const tv = entry.templateVersion
      ? String(entry.templateVersion).slice(0, 16)
      : null;
    await query(
      `INSERT INTO document_generation_log
         (id, entity, entity_id, template_id, file_name,
          sharepoint_path, web_url, status, error_code, duration_ms,
          user_id, ip, user_agent, attempts, template_version)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.entity,
        entry.entityId,
        entry.templateId,
        entry.fileName,
        entry.sharepointPath,
        entry.webUrl,
        entry.status,
        entry.errorCode ?? null,
        entry.durationMs,
        entry.userId ?? null,
        entry.ip ?? null,
        ua,
        attempts,
        tv,
      ],
    );
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[document-generation log] insert failed:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Valida y sanitiza la IP antes de persistirla.
 * M-4: rechaza IPs inválidas para no contaminar el log con basura.
 * Acepta IPv4 e IPv6 en formato estándar.
 */
const IP_REGEX = /^[\d.:a-fA-F]+$/;
const MAX_IP_LEN = 64;

export function sanitizeIp(ip: unknown): string | null {
  if (typeof ip !== "string") return null;
  const trimmed = ip.trim().slice(0, MAX_IP_LEN);
  if (!trimmed) return null;
  if (!IP_REGEX.test(trimmed)) return null;
  return trimmed;
}

/**
 * Variante transaccional de logGeneration. Usa la misma conexión del
 * caller (compartida con un BEGIN/COMMIT exterior) para que el INSERT
 * del log sea atómico con otras operaciones (ej. UPDATE de la URL en
 * la entidad).
 */
export async function logGenerationTx(
  conn: PoolConnection,
  entry: LogEntryInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ua = entry.userAgent ? String(entry.userAgent).slice(0, 255) : null;
    const attempts =
      typeof entry.attempts === "number" && entry.attempts > 0
        ? Math.min(255, entry.attempts)
        : null;
    const tv = entry.templateVersion
      ? String(entry.templateVersion).slice(0, 16)
      : null;
    const ip = sanitizeIp(entry.ip);
    await conn.query(
      `INSERT INTO document_generation_log
         (id, entity, entity_id, template_id, file_name,
          sharepoint_path, web_url, status, error_code, duration_ms,
          user_id, ip, user_agent, attempts, template_version)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.entity,
        entry.entityId,
        entry.templateId,
        entry.fileName,
        entry.sharepointPath,
        entry.webUrl,
        entry.status,
        entry.errorCode ?? null,
        entry.durationMs,
        entry.userId ?? null,
        ip,
        ua,
        attempts,
        tv,
      ],
    );
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[document-generation log] tx insert failed:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Variante transaccional de persistUrl. Ejecuta el UPDATE del campo
 * `generated_document_url` en la tabla de la entidad usando la misma
 * conexión que el caller (para que sea atómico con el INSERT del log).
 */
const ENTITY_TO_TABLE: Record<DocumentEntity, string> = {
  payments: "payment_requests",
  expenses: "expenses",
  cuts: "work_cuts",
  contracts: "contracts",
  employees: "employees",
  workLogs: "work_logs",
};

export async function persistUrlTx(
  conn: PoolConnection,
  entity: DocumentEntity,
  entityId: string,
  webUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const table = ENTITY_TO_TABLE[entity];
    await conn.query(
      `UPDATE \`${table}\` SET generated_document_url = ? WHERE id = ?`,
      [webUrl, entityId],
    );
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[document-generation] persistUrl failed:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Exporta el map entity→tabla para que el service pueda usarlo en su
 * variante no-transaccional.
 */
export { ENTITY_TO_TABLE };

/**
 * Lista entradas de log filtradas por entity + entityId.
 * Si el filtro es vacío, devuelve las últimas N.
 */
export async function listLog(
  filter: {
    entity?: DocumentEntity;
    entityId?: string;
    userId?: string;
    limit?: number;
  } = {},
): Promise<DocumentGenerationLogEntry[]> {
  const limit = Math.max(1, Math.min(filter.limit ?? 50, 200));
  const where: string[] = [];
  const args: unknown[] = [];
  if (filter.entity) {
    where.push("entity = ?");
    args.push(filter.entity);
  }
  if (filter.entityId) {
    where.push("entity_id = ?");
    args.push(filter.entityId);
  }
  if (filter.userId) {
    where.push("user_id = ?");
    args.push(filter.userId);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await query<any[]>(
    `SELECT * FROM document_generation_log ${whereSql}
     ORDER BY created_at DESC LIMIT ${limit}`,
    args,
  );
  return rows.map((r) => ({
    id: r.id,
    entity: r.entity,
    entityId: r.entity_id,
    templateId: r.template_id,
    fileName: r.file_name,
    sharepointPath: r.sharepoint_path,
    webUrl: r.web_url,
    status: r.status,
    errorCode: r.error_code,
    durationMs: Number(r.duration_ms),
    userId: r.user_id,
    ip: r.ip ?? null,
    templateVersion: r.template_version ?? null,
    userAgent: r.user_agent ?? null,
    attempts: r.attempts != null ? Number(r.attempts) : null,
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
  }));
}
