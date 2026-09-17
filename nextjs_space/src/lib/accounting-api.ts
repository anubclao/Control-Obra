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
  const err = e as { code?: string; message?: string };
  console.error(`[${module}]`, err?.code, err?.message);
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
