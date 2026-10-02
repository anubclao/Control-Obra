/**
 * lib/accounting-api.ts
 *
 * Utilidades compartidas por las rutas /api/accounting/*:
 *  - roles con permiso de escritura
 *  - filtro por alcance (?projectId=<id> | general)
 *  - helpers de mapeo row → DTO
 *
 * Spec: /docs/specs/accounting-module.md  (AC-1, AC-19)
 */

import { NextResponse } from "next/server";
import { ACCOUNTING_GENERAL_SCOPE } from "./accounting-constants";
import { query } from "./db";

/** Roles que pueden crear/editar registros contables (AC-19). */
export const ACCOUNTING_WRITE_ROLES = [
  "ADMIN",
  "GERENTE",
  "DIRECTOR",
  "CONTABILIDAD",
  "TESORERIA",
] as const;

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(module: string, e: unknown) {
  const err = e as { code?: string; message?: string; errno?: number };
  console.error(`[${module}]`, err?.code, err?.message);

  // P0 plan 2026-10-02 (Fase 2.3): mapear codigos MySQL a errores
  // legibles. Antes todo era "Error interno" 500 y el usuario no
  // sabia si fue FK, unique constraint, etc.
  const code = err?.code ?? "";
  const errno = err?.errno;
  if (code === "ER_NO_REFERENCED_ROW_2" || errno === 1452) {
    return NextResponse.json(
      {
        error:
          "FK invalida: el registro referencia una fila que no existe (cuenta, proyecto o usuario).",
        code: "FK_VIOLATION",
      },
      { status: 400 },
    );
  }
  if (code === "ER_DUP_ENTRY" || errno === 1062) {
    return NextResponse.json(
      {
        error:
          "Registro duplicado: ya existe una fila con el mismo identificador unico.",
        code: "DUPLICATE_ENTRY",
      },
      { status: 409 },
    );
  }
  if (code === "ER_ROW_IS_REFERENCED_2" || errno === 1451) {
    return NextResponse.json(
      {
        error:
          "No se puede eliminar: hay otros registros que dependen de este (FK activa).",
        code: "FK_HAS_CHILDREN",
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}

/**
 * Filtro por alcance. `?projectId=general` devuelve solo los registros sin
 * proyecto; sin parámetro devuelve el consolidado.
 */
export function scopeFilter(params: URLSearchParams): {
  where: string;
  args: unknown[];
} {
  const projectId = params.get("projectId");
  if (!projectId) return { where: "", args: [] };
  if (projectId === ACCOUNTING_GENERAL_SCOPE) {
    return { where: "WHERE project_id IS NULL", args: [] };
  }
  return { where: "WHERE project_id = ?", args: [projectId] };
}

/** Normaliza el projectId recibido del cliente: "" / "general" → null. */
export function normalizeProjectId(value: unknown): string | null {
  if (!value || value === ACCOUNTING_GENERAL_SCOPE) return null;
  return String(value);
}

export function money(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** DATE de MySQL → "YYYY-MM-DD" sin sorpresas de zona horaria. */
export function isoDate(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value ?? "").slice(0, 10);
}

export function newId(): string {
  return globalThis.crypto.randomUUID();
}

// =============================================================================
// Validadores Fase 2.1 + 2.2: pre-checks contra BD antes del INSERT.
// Devuelven { ok: true } o { ok: false, error: <mensaje legible> } para que
// la ruta pueda responder 400 con contexto. Antes esto daba 500 enmascarado.
// =============================================================================

/**
 * Valida que la cuenta contable exista y este activa (is_active=1).
 * Usado por todas las rutas POST/PUT de /api/accounting/* que aceptan
 * accountId. El FK en BD evita la FK rota, pero el flag is_active es
 * logica de negocio que solo se valida aqui.
 */
export type AccountCheckResult =
  | { ok: true }
  | { ok: false; error: string };

export async function assertAccountActive(
  accountId: string,
): Promise<AccountCheckResult> {
  const [rows] = await query<any[]>(
    `SELECT id, is_active FROM accounting_accounts WHERE id = ? LIMIT 1`,
    [accountId],
  );
  if (!rows || !rows.length) {
    return { ok: false, error: `La cuenta contable ${accountId} no existe` };
  }
  if (Number(rows[0].is_active) !== 1) {
    return {
      ok: false,
      error: `La cuenta contable ${accountId} esta inactiva. Activala primero.`,
    };
  }
  return { ok: true };
}

/**
 * Valida que el proyecto exista y no este soft-deleted. Antes el FK
 * RESTRICT con projects.id podia enmascararse como "Error interno"
 * 500 cuando el proyecto habia sido borrado logicamente.
 */
export async function assertProjectExists(
  projectId: string,
): Promise<AccountCheckResult> {
  const [rows] = await query<any[]>(
    `SELECT id, deleted_at FROM projects WHERE id = ? LIMIT 1`,
    [projectId],
  );
  if (!rows || !rows.length) {
    return { ok: false, error: `El proyecto ${projectId} no existe` };
  }
  if (rows[0].deleted_at) {
    return {
      ok: false,
      error: `El proyecto ${projectId} esta eliminado (soft delete)`,
    };
  }
  return { ok: true };
}
