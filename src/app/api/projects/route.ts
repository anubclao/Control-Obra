/**
 * CRUD: /api/projects
 *
 * Auth:
 *   GET    → cualquiera con sesión válida
 *   POST   → requireRole("ADMIN","GERENTE","DIRECTOR","RESIDENTE")
 *   PUT    → requireRole(idem)
 *   DELETE → requireAdmin (Super Admin)
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { ResultSetHeader } from "mysql2";
import {
  requireAuth,
  requireRole,
  requireAdmin,
  authFailureResponse,
} from "@/lib/api-auth";
import { can } from "@/lib/permissions-matrix";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mapear snake_case de BD → camelCase para el frontend
function rowToDTO(r: any) {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    client: r.client,
    location: r.location,
    startDate: r.start_date,
    estimatedEndDate: r.estimated_end_date,
    totalBudget: Number(r.total_budget ?? 0),
    // P1: `executedAmount` ahora viene derivado de cortes
    // APPROVED/PAID (ver GET handler). `manualExecutedAmount` conserva
    // el valor crudo de la BD para detectar drift.
    executedAmount: Number(r.executed_amount ?? 0),
    manualExecutedAmount: Number(
      r.manual_executed_amount ?? r.executed_amount ?? 0,
    ),
    status: r.status,
    description: r.description ?? "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  // P0 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.4):
  //   Antes cualquier usuario autenticado (incluso CLIENTE/USER) podia
  //   ver la lista de proyectos. Ahora la matriz decide: CLIENTE/USER
  //   no tienen permisos de lectura y reciben 403.
  if (!can((auth as any).user.role, "projects", "read")) {
    return NextResponse.json(
      { error: "No tienes permisos para ver proyectos" },
      { status: 403 },
    );
  }
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    // P0 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.2):
    //   Con soft delete, los proyectos archivados NO deben aparecer en los
    //   listados por defecto. `?includeArchived=1` los trae (uso admin).
    const includeArchived = url.searchParams.get("includeArchived") === "1";
    const conds: string[] = [];
    const args: any[] = [];
    if (!includeArchived) conds.push("deleted_at IS NULL");
    if (status) {
      conds.push("status = ?");
      args.push(status);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const rows = await query<any[]>(
      `SELECT * FROM projects ${where} ORDER BY created_at DESC`,
      args,
    );

    // P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.1):
    //   `executedAmount` antes era un campo manual que podia no
    //   coincidir con los cortes aprobados. Lo derivamos en lectura
    //   sumando los net_value de los cortes en APPROVED/PAID. Se
    //   mantiene `manualExecutedAmount` con el valor crudo de la BD
    //   para detectar drift; en una siguiente fase se quita del
    //   formulario de edicion.
    if (rows.length) {
      const ids = rows.map((r) => r.id);
      const placeholders = ids.map(() => "?").join(",");
      const totals = await query<any[]>(
        `SELECT project_id, COALESCE(SUM(net_value), 0) AS executed
           FROM work_cuts
          WHERE project_id IN (${placeholders})
            AND status IN ('APPROVED','PAID')
            AND deleted_at IS NULL
          GROUP BY project_id`,
        ids,
      );
      const totalsByProject: Record<string, number> = {};
      for (const t of totals) {
        totalsByProject[t.project_id] = Number(t.executed ?? 0);
      }
      for (const r of rows) {
        r.manual_executed_amount = Number(r.executed_amount ?? 0);
        r.executed_amount = totalsByProject[r.id] ?? 0;
      }
    }
    return NextResponse.json(rows.map(rowToDTO));
  } catch (e: any) {
    console.error("[projects GET]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN", "GERENTE", "DIRECTOR", "RESIDENTE");
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (
      !body?.name ||
      !body?.code ||
      !body?.client ||
      !body?.location ||
      !body?.startDate ||
      !body?.estimatedEndDate
    ) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 },
      );
    }
    const id = randomUUID();
    await query(
      `INSERT INTO projects
        (id, code, name, client, location, start_date, estimated_end_date,
         total_budget, executed_amount, status, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.code,
        body.name,
        body.client,
        body.location,
        body.startDate,
        body.estimatedEndDate,
        Number(body.totalBudget ?? 0),
        Number(body.executedAmount ?? 0),
        body.status ?? "IN_PLANNING",
        body.description ?? null,
      ],
    );
    return NextResponse.json({ id, ...body }, { status: 201 });
  } catch (e: any) {
    console.error("[projects POST]", e?.code, e?.message);
    if (e?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "Ya existe un proyecto con ese código" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Error al crear proyecto" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  const auth = await requireRole("ADMIN", "GERENTE", "DIRECTOR", "RESIDENTE");
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }
    const sets: string[] = [];
    const args: any[] = [];
    const map: Record<string, string> = {
      name: "name",
      client: "client",
      location: "location",
      startDate: "start_date",
      estimatedEndDate: "estimated_end_date",
      totalBudget: "total_budget",
      executedAmount: "executed_amount",
      status: "status",
      description: "description",
    };
    for (const [k, vCol] of Object.entries(map)) {
      if (body[k] !== undefined) {
        sets.push(`${vCol} = ?`);
        args.push(
          k === "totalBudget" || k === "executedAmount"
            ? Number(body[k])
            : body[k],
        );
      }
    }
    if (sets.length === 0) {
      return NextResponse.json(
        { error: "Nada que actualizar" },
        { status: 400 },
      );
    }
    args.push(body.id);
    await query(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[projects PUT]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    // P0 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.2):
    //   Antes esto hacia DELETE fisico y, por las FK en CASCADE de
    //   payment_requests y work_cuts, se llevaba puesto todo el historial
    //   financiero del proyecto (pagos PAID inclusive). Ahora hacemos
    //   soft delete: marcamos deleted_at y las FK en RESTRICT (ver
    //   migracion 010) impiden el borrado fisico mientras existan hijos.
    //   El proyecto deja de aparecer en los listados pero conserva su
    //   trazabilidad contable.
    const userId = (auth as { userId: string }).userId;
    const result = await query<ResultSetHeader>(
      `UPDATE projects
         SET deleted_at = CURRENT_TIMESTAMP,
             deleted_by = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [userId, id],
    );
    const affected = result.affectedRows ?? 0;
    if (affected === 0) {
      return NextResponse.json(
        { error: "Proyecto no encontrado o ya estaba archivado" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, softDeleted: true });
  } catch (e: any) {
    console.error("[projects DELETE]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
