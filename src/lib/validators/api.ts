/**
 * lib/validators/api.ts
 *
 * Helpers de paginacion compartidos por los GET de listados.
 *
 * P2 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.2):
 *   `GET /api/cuts` y `GET /api/quotations` leian TODAS las filas de
 *   items y documentos en cada llamada, sin filtro ni paginacion. Aqui
 *   centralizamos la lectura de `?page&limit`, con cap defensivo para
 *   que un cliente malicioso no pida un millon de filas.
 *
 * Ademas ofrece `groupByIds(rows, foreignKey)` para resolver el N+1
 * de items/documents sin traer la tabla completa.
 */

import { z } from "zod";

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

export const paginationSchema = z.object({
  page: z.number().int().min(1, "page debe ser >= 1").default(DEFAULT_PAGE),
  limit: z
    .number()
    .int()
    .min(1, "limit debe ser >= 1")
    .max(MAX_LIMIT, `limit maximo ${MAX_LIMIT}`)
    .default(DEFAULT_LIMIT),
});

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationResult {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Lee `?page&limit` desde la URL y devuelve defaults validados. */
export function parsePagination(url: URL): PaginationParams {
  const page = Number(url.searchParams.get("page") ?? DEFAULT_PAGE);
  const limit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const parsed = paginationSchema.safeParse({ page, limit });
  if (!parsed.success) {
    return { page: DEFAULT_PAGE, limit: DEFAULT_LIMIT };
  }
  return parsed.data;
}

/** Convierte (page, limit) en `LIMIT ? OFFSET ?` listo para SQL. */
export function pageToLimitOffset(p: PaginationParams): {
  limit: number;
  offset: number;
} {
  return { limit: p.limit, offset: (p.page - 1) * p.limit };
}

/** Calcula el total de paginas y el wrapper JSON. */
export function paginationMeta(
  total: number,
  p: PaginationParams,
): PaginationResult {
  return {
    total,
    page: p.page,
    limit: p.limit,
    totalPages: Math.max(1, Math.ceil(total / p.limit)),
  };
}

/**
 * Agrupa un array de filas (cada una con un campo `foreignKey`) en
 * `Record<id, rows[]>`. Pensado para resolver el N+1 inverso: traes
 * los hijos con `WHERE foreignKey IN (?)` y los agrupas.
 */
export function groupByIds<T extends Record<string, any>>(
  rows: T[],
  foreignKey: keyof T,
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const row of rows) {
    const key = String(row[foreignKey]);
    (out[key] ??= []).push(row);
  }
  return out;
}
