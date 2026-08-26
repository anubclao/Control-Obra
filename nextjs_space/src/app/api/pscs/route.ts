export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * CRUD: /api/pscs — Presupuesto Proveedor
 */
import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";


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

export async function GET(req: Request) {
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
  try {
    const body = await req.json();
    if (!body?.projectId || !body?.providerId) {
      return NextResponse.json({ error: "projectId y providerId requeridos" }, { status: 400 });
    }
    const id = require("crypto").randomUUID();
    const num = `PSC-${Date.now().toString(36).toUpperCase().slice(-6)}`;
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
