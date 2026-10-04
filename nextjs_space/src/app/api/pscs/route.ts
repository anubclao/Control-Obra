export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * CRUD: /api/pscs — Presupuesto Proveedor
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { requireAuth, requireRole, requireAdmin, authFailureResponse } from "@/lib/api-auth";


function r(row: any) {
  return {
    id: row.id,
    pscNumber: row.psc_number,
    projectId: row.project_id,
    budgetId: row.budget_id,
    providerId: row.provider_id,
    totalValue: Number(row.total_value),
    status: row.status,
    notes: row.notes ?? "",
    startDate: row.start_date,
    endDate: row.end_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * Calcula el siguiente PSC number con formato PSC-YYYY-NNNN.
 * Usa MAX sobre `psc_number` LIKE 'PSC-YYYY-%' (mas seguro que COUNT + 1
 * porque tolera huecos si hubo inserciones concurrentes o eliminaciones).
 * P0 plan 2026-10-04: el formato anterior (PSC-${Date.now().base36}) era opaco
 * y no incremental. El nuevo formato es legible y se ordena bien en BD.
 */
async function nextPscNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PSC-${year}-`;
  const rows = await query<any[]>(
    `SELECT psc_number FROM pscs
       WHERE psc_number LIKE ?
       ORDER BY psc_number DESC
       LIMIT 1`,
    [`${prefix}%`],
  );
  let nextSeq = 1;
  if (rows.length > 0) {
    const last = String(rows[0].psc_number ?? "");
    const m = last.match(/^PSC-\d{4}-(\d{4})$/);
    if (m) nextSeq = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const where = projectId ? "WHERE project_id = ?" : "";
    const args = projectId ? [projectId] : [];
    const [pscs, items] = await Promise.all([
      query<any[]>(`SELECT * FROM pscs ${where} ORDER BY created_at DESC`, args),
      query<any[]>(`SELECT * FROM psc_items`),
    ]);
    const byPsc: Record<string, any[]> = {};
    for (const it of items) {
      (byPsc[it.psc_id] ??= []).push({
        id: it.id,
        budgetItemId: it.budget_item_id,
        description: it.description,
        unit: it.unit,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unit_price),
        totalPrice: Number(it.total_price),
        executedQuantity: Number(it.executed_quantity),
        executedAmount: Number(it.executed_amount),
      });
    }
    return NextResponse.json(pscs.map((p) => ({ ...r(p), items: byPsc[p.id] ?? [] })));
  } catch (e: any) {
    console.error("[pscs GET]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN","GERENTE","DIRECTOR","RESIDENTE","CONTABILIDAD","TESORERIA","HSEQ");
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.projectId || !body?.providerId) {
      return NextResponse.json({ error: "projectId y providerId requeridos" }, { status: 400 });
    }
    const id = randomUUID();
    const num = await nextPscNumber();
    await transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO pscs (id, psc_number, project_id, budget_id, provider_id,
         total_value, status, notes, start_date, end_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, num, body.projectId, body.budgetId ?? null, body.providerId,
         Number(body.totalValue ?? 0), body.status ?? "DRAFT",
         body.notes ?? null, body.startDate ?? null, body.endDate ?? null,
         body.createdBy ?? null],
      );
      for (const it of body.items ?? []) {
        await conn.execute(
          `INSERT INTO psc_items (id, psc_id, budget_item_id, description, unit,
           quantity, unit_price, total_price, executed_quantity, executed_amount)
           VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, it.budgetItemId ?? null, it.description, it.unit,
           Number(it.quantity ?? 0), Number(it.unitPrice ?? 0),
           Number(it.totalPrice ?? 0),
           Number(it.executedQuantity ?? 0), Number(it.executedAmount ?? 0)],
        );
      }
    });
    return NextResponse.json({ id, ...body, pscNumber: num }, { status: 201 });
  } catch (e: any) {
    console.error("[pscs POST]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al crear PSC" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireRole("ADMIN","GERENTE","DIRECTOR","RESIDENTE","CONTABILIDAD","TESORERIA","HSEQ");
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const m: Record<string, string> = {
      projectId: "project_id", budgetId: "budget_id", providerId: "provider_id",
      totalValue: "total_value", status: "status", notes: "notes",
      startDate: "start_date", endDate: "end_date",
    };
    const sets: string[] = []; const args: any[] = [];
    for (const [k, c] of Object.entries(m)) {
      if (body[k] !== undefined) {
        sets.push(`${c} = ?`);
        args.push(k === "totalValue" ? Number(body[k]) : body[k]);
      }
    }
    if (sets.length) {
      args.push(body.id);
      await query(`UPDATE pscs SET ${sets.join(", ")} WHERE id = ?`, args);
    }
    if (Array.isArray(body.items)) {
      await transaction(async (conn) => {
        await conn.execute(`DELETE FROM psc_items WHERE psc_id = ?`, [body.id]);
        for (const it of body.items) {
          await conn.execute(
            `INSERT INTO psc_items (id, psc_id, budget_item_id, description, unit,
             quantity, unit_price, total_price, executed_quantity, executed_amount)
             VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [body.id, it.budgetItemId ?? null, it.description, it.unit,
             Number(it.quantity ?? 0), Number(it.unitPrice ?? 0),
             Number(it.totalPrice ?? 0),
             Number(it.executedQuantity ?? 0), Number(it.executedAmount ?? 0)],
          );
        }
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[pscs PUT]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    await query("DELETE FROM pscs WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[pscs DELETE]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
