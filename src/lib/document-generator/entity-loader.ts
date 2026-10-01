// filepath: src/lib/document-generator/entity-loader.ts
// Carga el record de una entidad (payment_request, expense, cut, contract,
// employee, work_log) por su id, más los lookups a `projects` y `providers`
// que necesita el FillerContext.
//
// Mantener en sincronía con la matriz del spec §2.1 y con el schema
// real de la BD (database/mysql/init.sql + 006).

import { query } from "@/lib/db";
import type { DocumentEntity } from "@/types/documents";

/**
 * Row crudo (MySQL snake_case). Se mantiene como `unknown` para que el caller
 * decida qué campos necesita.
 */
export interface LoadedEntity {
  entity: DocumentEntity;
  id: string;
  raw: Record<string, unknown>;
}

interface SqlEntityMap {
  table: string;
  pk: string;
}

const ENTITY_TO_TABLE: Record<DocumentEntity, SqlEntityMap> = {
  payments: { table: "payment_requests", pk: "id" },
  expenses: { table: "expenses", pk: "id" },
  cuts: { table: "work_cuts", pk: "id" },
  contracts: { table: "contracts", pk: "id" },
  employees: { table: "employees", pk: "id" },
  workLogs: { table: "work_logs", pk: "id" },
};

export type EntityLoadError =
  | { code: "ENTITY_NOT_FOUND"; entity: DocumentEntity; id: string }
  | { code: "INTERNAL"; message: string };

export type EntityLoadResult =
  | { ok: true; entity: LoadedEntity }
  | { ok: false; error: EntityLoadError };

/**
 * Carga una entidad por id. Devuelve el row crudo.
 *
 * Se inyecta `queryFn` para tests (mocks sin tocar la BD real).
 */
export async function loadEntity(
  entity: DocumentEntity,
  entityId: string,
  queryFn: typeof query = query,
): Promise<EntityLoadResult> {
  const map = ENTITY_TO_TABLE[entity];
  if (!map) {
    return {
      ok: false,
      error: { code: "INTERNAL", message: `Unknown entity ${entity}` },
    };
  }
  if (!entityId || typeof entityId !== "string") {
    return {
      ok: false,
      error: { code: "ENTITY_NOT_FOUND", entity, id: String(entityId) },
    };
  }
  try {
    const rows = await queryFn<any[]>(
      `SELECT * FROM ${map.table} WHERE ${map.pk} = ? LIMIT 1`,
      [entityId],
    );
    if (!rows.length) {
      return {
        ok: false,
        error: { code: "ENTITY_NOT_FOUND", entity, id: entityId },
      };
    }
    return {
      ok: true,
      entity: { entity, id: entityId, raw: rows[0] as Record<string, unknown> },
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: { code: "INTERNAL", message } };
  }
}

// ─── Lookups de FK ─────────────────────────────────────────────────

export interface ProjectView {
  code: string;
  name: string;
  client: string;
  location: string;
}

export interface ProviderView {
  name: string;
  nit: string;
  email?: string;
  phone?: string;
  address?: string;
}

/** Carga un proyecto por id. */
export async function loadProject(
  projectId: string,
  queryFn: typeof query = query,
): Promise<ProjectView | null> {
  if (!projectId) return null;
  try {
    const rows = await queryFn<any[]>(
      `SELECT code, name, client, location FROM projects WHERE id = ? LIMIT 1`,
      [projectId],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      code: String(r.code ?? ""),
      name: String(r.name ?? ""),
      client: String(r.client ?? ""),
      location: String(r.location ?? ""),
    };
  } catch {
    return null;
  }
}

/** Carga un proveedor por id. */
export async function loadProvider(
  providerId: string | null | undefined,
  queryFn: typeof query = query,
): Promise<ProviderView | null> {
  if (!providerId) return null;
  try {
    const rows = await queryFn<any[]>(
      `SELECT name, nit, email, phone, address FROM providers WHERE id = ? LIMIT 1`,
      [providerId],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      name: String(r.name ?? ""),
      nit: String(r.nit ?? ""),
      email: r.email ? String(r.email) : undefined,
      phone: r.phone ? String(r.phone) : undefined,
      address: r.address ? String(r.address) : undefined,
    };
  } catch {
    return null;
  }
}

// ─── Normalización y mapping ───────────────────────────────────────

/**
 * snake_case → camelCase. Ej: `project_id` → `projectId`, `due_date` → `dueDate`.
 */
export function normalizeEntity(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = row[k];
  }
  return out;
}

/**
 * Resuelve qué plantilla usar. Es un wrapper delgado sobre el registry
 * que extrae los discriminadores (`type`, `contractType`, etc.) del row
 * normalizado.
 */
export function toResolveInput(
  entity: DocumentEntity,
  normalized: Record<string, unknown>,
): {
  type?: string;
  contractType?: string;
  pricingMode?: string;
  workLogType?: string;
} {
  switch (entity) {
    case "payments":
      return {
        type: typeof normalized.type === "string" ? normalized.type : undefined,
      };
    case "expenses":
      return {
        type: typeof normalized.type === "string" ? normalized.type : undefined,
      };
    case "contracts":
      return {
        contractType:
          typeof normalized.type === "string" ? normalized.type : undefined,
        pricingMode:
          typeof normalized.pricingMode === "string"
            ? normalized.pricingMode
            : undefined,
      };
    case "workLogs":
      return {
        workLogType:
          typeof normalized.type === "string" ? normalized.type : undefined,
        type: typeof normalized.type === "string" ? normalized.type : undefined,
      };
    default:
      return {};
  }
}

/**
 * Extrae el `providerId` de un row normalizado, o null.
 * payments: providerId; expenses: providerId; contracts: providerId;
 * cuts: providerId; workLogs: createdBy (no provider).
 */
export function extractProviderId(
  entity: DocumentEntity,
  normalized: Record<string, unknown>,
): string | null {
  const v = normalized.providerId;
  if (typeof v === "string" && v.length > 0) return v;
  return null;
}

/** Extrae el `projectId` de un row normalizado, o null. */
export function extractProjectId(
  normalized: Record<string, unknown>,
): string | null {
  const v = normalized.projectId;
  if (typeof v === "string" && v.length > 0) return v;
  return null;
}
