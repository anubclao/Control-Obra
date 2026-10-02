export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * CRUD: /api/expenses — Registro de gastos
 *
 * P0 plan 2026-10-02 (Fase 1.4): cuando un gasto (OC / OS / LEG) pasa
 * a status PAGADO, generamos automaticamente un movimiento contable
 * (accounting_expenses PAGADO). Si la transicion llega SIN cuenta
 * contable, queda en POR_PAGAR (mismo patron que cortes) para que el
 * panel contable muestre el gasto ejecutado aunque el pago real este
 * pendiente.
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { requireAuth, requireRole, requireAdmin, authFailureResponse, type AuthSuccess } from "@/lib/api-auth";
import { syncExpenseOnPayment } from "@/lib/accounting-integration";


function r(row: any) {
  return {
    id: row.id,
    expenseNumber: row.expense_number,
    projectId: row.project_id,
    providerId: row.provider_id,
    type: row.type,
    description: row.description,
    amount: Number(row.amount),
    date: row.date,
    status: row.status,
    advancePercent: row.advance_percent != null ? Number(row.advance_percent) : null,
    hasPolizas: row.has_polizas === 1,
    polizasVigenciaDesde: row.polizas_vigencia_desde,
    polizasVigenciaHasta: row.polizas_vigencia_hasta,
    cotizacionAprobada: row.cotizacion_aprobada === 1,
    approvedBy: row.approved_by,
    approvedByName: row.approved_by_name,
    approvedAt: row.approved_at,
    rejectedReason: row.rejected_reason ?? "",
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  };
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const status = url.searchParams.get("status");
    const conds: string[] = [];
    const args: any[] = [];
    if (projectId) { conds.push("project_id = ?"); args.push(projectId); }
    if (status) { conds.push("status = ?"); args.push(status); }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const [exps, items] = await Promise.all([
      query<any[]>(`SELECT * FROM expenses ${where} ORDER BY created_at DESC`, args),
      query<any[]>(`SELECT * FROM expense_items`),
    ]);
    const byExp: Record<string, any[]> = {};
    for (const it of items) {
      (byExp[it.expense_id] ??= []).push({
        id: it.id,
        description: it.description,
        quantity: Number(it.quantity),
        unit: it.unit,
        unitPrice: Number(it.unit_price),
        totalPrice: Number(it.total_price),
      });
    }
    return NextResponse.json(exps.map((e) => ({ ...r(e), items: byExp[e.id] ?? [] })));
  } catch (e: any) {
    console.error("[expenses GET]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN","GERENTE","DIRECTOR","RESIDENTE","CONTABILIDAD","TESORERIA","HSEQ");
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.projectId || !body?.providerId || !body?.type ||
        !body?.description || !body?.amount || !body?.date) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }
    const id = randomUUID();
    const num = `GAS-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    await transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO expenses (id, expense_number, project_id, provider_id, type,
         description, amount, date, status, advance_percent, has_polizas,
         polizas_vigencia_desde, polizas_vigencia_hasta, cotizacion_aprobada,
         created_by, created_by_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, num, body.projectId, body.providerId, body.type,
         body.description, Number(body.amount), body.date,
         body.status ?? "DRAFT",
         body.advancePercent ? Number(body.advancePercent) : null,
         body.hasPolizas ? 1 : 0,
         body.polizasVigenciaDesde ?? null,
         body.polizasVigenciaHasta ?? null,
         body.cotizacionAprobada ? 1 : 0,
         body.createdBy ?? null,
         body.createdByName ?? null],
      );
      for (const it of body.items ?? []) {
        await conn.execute(
          `INSERT INTO expense_items (id, expense_id, description, quantity, unit, unit_price, total_price)
           VALUES (UUID(), ?, ?, ?, ?, ?, ?)`,
          [id, it.description, Number(it.quantity), it.unit,
           Number(it.unitPrice), Number(it.totalPrice)],
        );
      }
    });
    return NextResponse.json({ id, ...body, expenseNumber: num }, { status: 201 });
  } catch (e: any) {
    console.error("[expenses POST]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al crear gasto" }, { status: 500 });
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
      type: "type", description: "description", amount: "amount",
      date: "date", status: "status", advancePercent: "advance_percent",
      hasPolizas: "has_polizas", polizasVigenciaDesde: "polizas_vigencia_desde",
      polizasVigenciaHasta: "polizas_vigencia_hasta",
      cotizacionAprobada: "cotizacion_aprobada",
      approvedBy: "approved_by", approvedByName: "approved_by_name",
      approvedAt: "approved_at", rejectedReason: "rejected_reason",
    };
    const sets: string[] = []; const args: any[] = [];
    for (const [k, c] of Object.entries(m)) {
      if (body[k] !== undefined) {
        sets.push(`${c} = ?`);
        args.push(
          ["amount", "advancePercent"].includes(k) ? Number(body[k]) :
          ["hasPolizas", "cotizacionAprobada"].includes(k) ? (body[k] ? 1 : 0) :
          body[k],
        );
      }
    }
    if (sets.length) {
      args.push(body.id);
      await query(`UPDATE expenses SET ${sets.join(", ")} WHERE id = ?`, args);
    }
    if (Array.isArray(body.items)) {
      await transaction(async (conn) => {
        await conn.execute(`DELETE FROM expense_items WHERE expense_id = ?`, [body.id]);
        for (const it of body.items) {
          await conn.execute(
            `INSERT INTO expense_items (id, expense_id, description, quantity, unit, unit_price, total_price)
             VALUES (UUID(), ?, ?, ?, ?, ?, ?)`,
            [body.id, it.description, Number(it.quantity), it.unit,
             Number(it.unitPrice), Number(it.totalPrice)],
          );
        }
      });
    }

    // P0 plan 2026-10-02 (Fase 1.4): si la transicion lleva el gasto
    // a PAGADO, generamos el movimiento contable. Requiere accountId
    // para imputar el egreso a una cuenta real (FK accounting_accounts).
    if (body.status === "PAGADO") {
      const accountId = body.accountId ?? null;
      if (!accountId) {
        return NextResponse.json(
          {
            error:
              "Para marcar el gasto como PAGADO debes indicar la cuenta contable de salida",
            code: "PAYMENT_ACCOUNT_REQUIRED",
          },
          { status: 400 },
        );
      }
      const [expRows] = await query<any[]>(
        `SELECT project_id, amount, description, expense_number
           FROM expenses WHERE id = ?`,
        [body.id],
      );
      const exp = (expRows as any[])[0] ?? {};
      const sync = await syncExpenseOnPayment(
        {
          userId: (auth as AuthSuccess).userId,
          sourceType: "EXPENSE",
          sourceId: body.id,
          date: new Date().toISOString().slice(0, 10),
          projectId: exp.project_id ?? null,
          costCenter: exp.project_id ? "Obra" : "Administracion",
          responsible: (auth as AuthSuccess).user.name ?? "",
          concept: `Gasto ${exp.expense_number ?? body.id}`,
          detail: exp.description ?? null,
          amount: Number(exp.amount ?? 0),
          accountId,
        },
      );
      if (sync.ok === false) {
        return NextResponse.json(
          { error: sync.error, code: sync.code },
          { status: 400 },
        );
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[expenses PUT]", e?.code, e?.message);
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
    const r0 = await query<any[]>(`SELECT status FROM expenses WHERE id = ?`, [id]);
    if (!r0.length) return NextResponse.json({ error: "Gasto no existe" }, { status: 404 });
    if (!["DRAFT", "REJECTED"].includes(r0[0].status)) {
      return NextResponse.json(
        { error: "Solo se eliminan gastos en DRAFT o REJECTED" }, { status: 400 },
      );
    }
    await query("DELETE FROM expenses WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[expenses DELETE]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
