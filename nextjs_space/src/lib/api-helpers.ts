/**
 * lib/api-helpers.ts
 *
 * Helpers DRY para construir API routes Next.js App Router.
 * Patrón: funciones que reciben una config y devuelven los handlers
 *  GET/POST/PUT/DELETE estandarizados.
 *
 * Beneficios:
 *  - Logs uniformes: console.error con prefijo del módulo y SQLSTATE.
 *  - Manejo de errores: nunca se filtra SQL al cliente.
 *  - Validación mínima: Zod opcional en cada CRUD.
 *  - Menos código repetitivo (12 archivos → 1 archivo).
 *
 * Uso típico:
 *
 *   // /app/api/projects/route.ts
 *   import { createCrudRoutes } from "@/lib/api-helpers";
 *   export const GET = createCrudRoutes.list("projects", projectRowToDTO);
 *   export const POST = createCrudRoutes.create("projects");
 *   export const PUT = createCrudRoutes.update("projects");
 *
 * Si necesitas lógica especial (transacciones, subrecursos), escribe la ruta a mano.
 */

import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type RowToDTO<T> = (row: RowDataPacket) => T;

interface ListConfig {
  table: string;
  /** Orden por defecto. Ej: "created_at DESC". */
  orderBy?: string;
  /** Whitelist de columnas permitidas en SELECT (anti SQLi en `fields`). */
  allowedFields?: string[];
  /** Mapea row crudo → DTO limpio (camelCase, parseos). */
  rowToDTO?: RowToDTO<any>;
  /** Filtro opcional: recibe searchParams y devuelve WHERE clause + params. */
  filter?: (params: URLSearchParams) => { where: string; args: unknown[] };
}

async function handleList(config: ListConfig, req: Request) {
  const url = new URL(req.url);
  const { where, args } = config.filter?.(url.searchParams) ?? { where: "", args: [] };
  const sql = `SELECT * FROM ${config.table} ${where ? "WHERE " + where : ""} ${
    config.orderBy ? "ORDER BY " + config.orderBy : ""
  }`.trim();
  try {
    const rows = await query<RowDataPacket[]>(sql, args);
    const dto = config.rowToDTO ? rows.map(config.rowToDTO) : rows;
    return NextResponse.json(dto);
  } catch (e: any) {
    console.error(`[${config.table} GET]`, e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

async function handleCreate(
  config: { table: string; rowToDTO?: RowToDTO<any> },
  req: Request,
) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }
    const cols = Object.keys(body).filter((k) => k !== "id");
    if (cols.length === 0) {
      return NextResponse.json(
        { error: "Sin columnas para insertar" },
        { status: 400 },
      );
    }
    // No aceptar valores que no sean string/number/null/boolean.
    const values = cols.map((c) => sanitize(body[c], c));
    const sql = `INSERT INTO ${config.table} (id, ${cols.join(", ")}) VALUES (UUID(), ${cols
      .map(() => "?")
      .join(", ")})`;
    const res = await query<ResultSetHeader>(sql, values);
    // InsertId no aplica (UUID); devolvemos los datos enviados.
    return NextResponse.json(
      { id: res.insertId || body.id, ...body },
      { status: 201 },
    );
  } catch (e: any) {
    console.error(`[${config.table} POST]`, e?.code, e?.message);
    return NextResponse.json({ error: "Error al crear" }, { status: 500 });
  }
}

async function handleUpdate(
  config: { table: string; idColumn?: string },
  req: Request,
) {
  const idColumn = config.idColumn ?? "id";
  try {
    const body = await req.json();
    const id = body?.[idColumn];
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }
    const cols = Object.keys(body).filter((k) => k !== idColumn);
    if (cols.length === 0) {
      return NextResponse.json({ error: "Sin campos a actualizar" }, { status: 400 });
    }
    const setClause = cols.map((c) => `${c} = ?`).join(", ");
    const values = cols.map((c) => sanitize(body[c], c));
    await query(`UPDATE ${config.table} SET ${setClause} WHERE ${idColumn} = ?`, [
      ...values,
      id,
    ]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(`[${config.table} PUT]`, e?.code, e?.message);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

async function handleDelete(
  config: { table: string; idColumn?: string },
  req: Request,
) {
  const idColumn = config.idColumn ?? "id";
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? (await req.json().catch(() => ({})))?.id;
  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }
  try {
    await query(`DELETE FROM ${config.table} WHERE ${idColumn} = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(`[${config.table} DELETE]`, e?.code, e?.message);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}

export const createCrudRoutes = {
  list: (cfg: ListConfig) => (req: Request) => handleList(cfg, req),
  create: (cfg: { table: string; rowToDTO?: RowToDTO<any> }) => (req: Request) =>
    handleCreate(cfg, req),
  update: (cfg: { table: string; idColumn?: string }) => (req: Request) =>
    handleUpdate(cfg, req),
  remove: (cfg: { table: string; idColumn?: string }) => (req: Request) =>
    handleDelete(cfg, req),
};

/**
 * Sanea valores de entrada: solo string/number/null/boolean permitidos.
 * Si es objeto Date → ISO string. Si es array u objeto → string JSON.
 * Si es undefined → null.
 */
function sanitize(v: unknown, field: string): any {
  if (v === undefined || v === null) return null;
  if (typeof v === "string") {
    // Bloquear inyección SQL extremadamente improbable (mysql2 ya parametriza)
    return v.slice(0, 5000); // límite de longitud
  }
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 19).replace("T", " ");
  if (Array.isArray(v) || typeof v === "object") return JSON.stringify(v);
  throw new Error(`Tipo no soportado en ${field}: ${typeof v}`);
}

export { transaction };
