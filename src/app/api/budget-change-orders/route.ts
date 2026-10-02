export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * CRUD + workflow: /api/budget-change-orders — Control de Cambios (CC-001…)
 *
 *   GET    ?budgetId=            lista los CC del presupuesto con sus ítems
 *   POST   { budgetId, … }       crea en DRAFT (congela el AIU del proyecto)
 *   PUT    { id, … }             edita (solo DRAFT / REJECTED)
 *   DELETE ?id=                  elimina (solo DRAFT / REJECTED)
 *   PATCH  { id, action, … }     SUBMIT | APPROVE | REJECT
 *
 * Totales, rol y auditoría se calculan/leen en el servidor. Reglas en
 * lib/budget-change-control.ts. Spec: docs/specs/budget-change-control.md
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { requireAuth, requireRole, authFailureResponse, type AuthSuccess } from "@/lib/api-auth";
import { IVA_ON_UTILITY_PCT } from "@/lib/aiu-constants";
import {
  CHANGE_ORDER_EDITOR_ROLES,
  applyChangeOrderToBudget,
  computeChangeOrderTotals,
  evaluateChangeOrderAction,
  formatChangeOrderNumber,
  isChangeOrderEditable,
  validateChangeOrderInput,
  type ChangeOrderItemInput,
} from "@/lib/budget-change-control";
import type { BudgetChangeOrder, ChangeOrderAction } from "@/types";

function itemDto(r: any) {
  return {
    id: r.id,
    chapterCode: r.chapter_code ?? undefined,
    itemCode: r.item_code ?? undefined,
    description: r.description,
    unit: r.unit,
    quantity: Number(r.quantity),
    unitPrice: Number(r.unit_price),
    totalPrice: Number(r.total_price),
  };
}

function dto(r: any, items: any[]): BudgetChangeOrder {
  return {
    id: r.id,
    budgetId: r.budget_id,
    number: r.number,
    issueDate: r.issue_date,
    requestChannel: r.request_channel,
    requestChannelOther: r.request_channel_other ?? undefined,
    description: r.description,
    advisorName: r.advisor_name ?? undefined,
    items: items.map(itemDto),
    aiuSnapshot: {
      administration: Number(r.aiu_administration),
      imprevistos: Number(r.aiu_imprevistos),
      utilidad: Number(r.aiu_utilidad),
      ivaOnUtility: Number(r.iva_on_utility_pct),
    },
    directCost: Number(r.direct_cost),
    total: Number(r.total),
    status: r.status,
    rejectionReason: r.rejection_reason ?? undefined,
    resultingVersionId: r.resulting_version_id ?? undefined,
    createdBy: r.created_by,
    submittedBy: r.submitted_by ?? undefined,
    submittedAt: r.submitted_at ?? undefined,
    approvedBy: r.approved_by ?? undefined,
    approvedAt: r.approved_at ?? undefined,
    createdAt: r.created_at,
  };
}

function parseItems(raw: unknown): ChangeOrderItemInput[] {
  return (Array.isArray(raw) ? raw : []).map((it: any) => ({
    chapterCode: it?.chapterCode ? String(it.chapterCode) : undefined,
    itemCode: it?.itemCode ? String(it.itemCode) : undefined,
    description: String(it?.description ?? "").trim(),
    unit: String(it?.unit ?? "").trim() || "UND",
    quantity: Number(it?.quantity),
    unitPrice: Number(it?.unitPrice),
  }));
}

function now() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function badRequest(v: { code?: string; error?: string }) {
  return NextResponse.json({ code: v.code, error: v.error }, { status: 400 });
}

async function insertItems(conn: any, changeOrderId: string, items: ReturnType<typeof computeChangeOrderTotals>["items"]) {
  for (const [position, it] of items.entries()) {
    await conn.execute(
      `INSERT INTO budget_change_order_items
         (id, change_order_id, position, chapter_code, item_code, description,
          unit, quantity, unit_price, total_price)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [changeOrderId, position, it.chapterCode ?? null, it.itemCode ?? null,
       it.description, it.unit, it.quantity, it.unitPrice, it.totalPrice],
    );
  }
}

async function loadChangeOrder(id: string) {
  const rows = await query<any[]>(`SELECT * FROM budget_change_orders WHERE id = ?`, [id]);
  return rows[0] ?? null;
}

// ═══════════════════════════════════ GET ═══════════════════════════════════
export async function GET(req: Request) {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const budgetId = new URL(req.url).searchParams.get("budgetId");
    if (!budgetId) return NextResponse.json({ error: "budgetId requerido" }, { status: 400 });
    const [orders, items] = await Promise.all([
      query<any[]>(
        `SELECT * FROM budget_change_orders WHERE budget_id = ? ORDER BY seq DESC`,
        [budgetId],
      ),
      query<any[]>(
        `SELECT i.* FROM budget_change_order_items i
           JOIN budget_change_orders c ON c.id = i.change_order_id
          WHERE c.budget_id = ?
          ORDER BY i.position ASC`,
        [budgetId],
      ),
    ]);
    const byOrder: Record<string, any[]> = {};
    for (const it of items) (byOrder[it.change_order_id] ??= []).push(it);
    return NextResponse.json(orders.map((o) => dto(o, byOrder[o.id] ?? [])));
  } catch (e: any) {
    console.error("[budget-change-orders GET]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ═══════════════════════════════════ POST ═══════════════════════════════════
export async function POST(req: Request) {
  const auth = await requireRole(...CHANGE_ORDER_EDITOR_ROLES);
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  const { userId } = auth as AuthSuccess;
  try {
    const body = await req.json();
    if (!body?.budgetId) return NextResponse.json({ error: "budgetId requerido" }, { status: 400 });
    const v = validateChangeOrderInput(body);
    if (!v.ok) return badRequest(v);

    // AIU del proyecto: se congela en el CC (AC-2).
    const aiuRows = await query<any[]>(
      `SELECT a.administration, a.imprevistos, a.utilidad
         FROM aiu_configs a
         JOIN budgets b ON b.project_id = a.project_id
        WHERE b.id = ?`,
      [body.budgetId],
    );
    if (!aiuRows.length) {
      return NextResponse.json(
        { code: "AIU_NOT_CONFIGURED", error: "Configura el AIU del proyecto antes de crear un control de cambios" },
        { status: 409 },
      );
    }
    const aiu = {
      administration: Number(aiuRows[0].administration),
      imprevistos: Number(aiuRows[0].imprevistos),
      utilidad: Number(aiuRows[0].utilidad),
    };
    const totals = computeChangeOrderTotals(parseItems(body.items), aiu);
    const id = randomUUID();
    const issueDate = body.issueDate || now().slice(0, 10);

    const number = await transaction(async (conn) => {
      // Consecutivo por presupuesto con bloqueo de fila: nunca se reutiliza.
      const [budgets] = await conn.query<any[]>(
        `SELECT id, change_order_seq FROM budgets WHERE id = ? FOR UPDATE`,
        [body.budgetId],
      );
      if (!budgets.length) return null;
      const seq = Number(budgets[0].change_order_seq ?? 0) + 1;
      await conn.execute(`UPDATE budgets SET change_order_seq = ? WHERE id = ?`, [seq, body.budgetId]);
      const num = formatChangeOrderNumber(seq);
      await conn.execute(
        `INSERT INTO budget_change_orders
           (id, budget_id, seq, number, issue_date, request_channel, request_channel_other,
            description, advisor_name, aiu_administration, aiu_imprevistos, aiu_utilidad,
            iva_on_utility_pct, direct_cost, total, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
        [id, body.budgetId, seq, num, issueDate, body.requestChannel,
         body.requestChannel === "OTROS" ? String(body.requestChannelOther).trim() : null,
         String(body.description).trim(), body.advisorName ?? null,
         aiu.administration, aiu.imprevistos, aiu.utilidad, IVA_ON_UTILITY_PCT,
         totals.directCost, totals.total, userId],
      );
      await insertItems(conn, id, totals.items);
      return num;
    });
    if (!number) return NextResponse.json({ error: "Presupuesto no existe" }, { status: 404 });

    return NextResponse.json(
      {
        id, budgetId: body.budgetId, number, issueDate,
        requestChannel: body.requestChannel, description: body.description,
        items: totals.items, directCost: totals.directCost, total: totals.total,
        aiuSnapshot: { ...aiu, ivaOnUtility: IVA_ON_UTILITY_PCT },
        status: "DRAFT", createdBy: userId,
      },
      { status: 201 },
    );
  } catch (e: any) {
    console.error("[budget-change-orders POST]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al crear control de cambios" }, { status: 500 });
  }
}

// ═══════════════════════════════════ PUT ═══════════════════════════════════
export async function PUT(req: Request) {
  const auth = await requireRole(...CHANGE_ORDER_EDITOR_ROLES);
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const current = await loadChangeOrder(body.id);
    if (!current) return NextResponse.json({ error: "Control de cambios no existe" }, { status: 404 });
    if (!isChangeOrderEditable(current.status)) {
      return NextResponse.json(
        { code: "CHANGE_ORDER_NOT_EDITABLE", error: "Solo se editan controles en borrador o rechazados" },
        { status: 409 },
      );
    }
    const v = validateChangeOrderInput(body);
    if (!v.ok) return badRequest(v);

    // Se recalcula con el AIU congelado del CC, no con el actual del proyecto.
    const totals = computeChangeOrderTotals(parseItems(body.items), {
      administration: Number(current.aiu_administration),
      imprevistos: Number(current.aiu_imprevistos),
      utilidad: Number(current.aiu_utilidad),
    });

    await transaction(async (conn) => {
      await conn.execute(
        `UPDATE budget_change_orders SET
           issue_date = ?, request_channel = ?, request_channel_other = ?,
           description = ?, advisor_name = ?, direct_cost = ?, total = ?
         WHERE id = ?`,
        [body.issueDate || current.issue_date, body.requestChannel,
         body.requestChannel === "OTROS" ? String(body.requestChannelOther).trim() : null,
         String(body.description).trim(), body.advisorName ?? current.advisor_name ?? null,
         totals.directCost, totals.total, body.id],
      );
      await conn.execute(`DELETE FROM budget_change_order_items WHERE change_order_id = ?`, [body.id]);
      await insertItems(conn, body.id, totals.items);
    });
    return NextResponse.json({ ok: true, directCost: totals.directCost, total: totals.total });
  } catch (e: any) {
    console.error("[budget-change-orders PUT]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

// ═══════════════════════════════════ DELETE ═══════════════════════════════════
export async function DELETE(req: Request) {
  const auth = await requireRole(...CHANGE_ORDER_EDITOR_ROLES);
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const current = await loadChangeOrder(id);
    if (!current) return NextResponse.json({ error: "Control de cambios no existe" }, { status: 404 });
    if (!isChangeOrderEditable(current.status)) {
      return NextResponse.json(
        { code: "CHANGE_ORDER_NOT_EDITABLE", error: "Solo se eliminan controles en borrador o rechazados" },
        { status: 409 },
      );
    }
    await query(`DELETE FROM budget_change_orders WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[budget-change-orders DELETE]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}

// ═══════════════════════════════════ PATCH ═══════════════════════════════════
export async function PATCH(req: Request) {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  // Quién actúa sale de la sesión; `body.user` se ignora.
  const { user } = auth as AuthSuccess;
  try {
    const body = await req.json();
    const { id, action, rejectionReason } = body ?? {};
    if (!id || !action) return NextResponse.json({ error: "id y action requeridos" }, { status: 400 });

    const current = await loadChangeOrder(id);
    if (!current) return NextResponse.json({ error: "Control de cambios no existe" }, { status: 404 });

    const decision = evaluateChangeOrderAction(current.status, action as ChangeOrderAction, user.role, { rejectionReason });
    if (!decision.ok) {
      return NextResponse.json({ error: decision.error, code: decision.code }, { status: decision.status });
    }
    const ts = now();

    await transaction(async (conn) => {
      if (action === "SUBMIT") {
        await conn.execute(
          `UPDATE budget_change_orders SET status = ?, submitted_by = ?, submitted_at = ?,
             rejection_reason = NULL
           WHERE id = ? AND status = ?`,
          [decision.target, user.id, ts, id, current.status],
        );
        return;
      }
      if (action === "REJECT") {
        await conn.execute(
          `UPDATE budget_change_orders SET status = ?, rejected_by = ?, rejected_at = ?,
             rejection_reason = ?
           WHERE id = ? AND status = ?`,
          [decision.target, user.id, ts, String(rejectionReason).trim(), id, current.status],
        );
        return;
      }

      // APPROVE: versión n+1 del PT y costo directo sumado a Tope y Cliente (AC-9).
      const [budgets] = await conn.query<any[]>(
        `SELECT id, total_value, client_value FROM budgets WHERE id = ? FOR UPDATE`,
        [current.budget_id],
      );
      const [versions] = await conn.query<any[]>(
        `SELECT COALESCE(MAX(version), 0) AS max_version FROM budget_versions WHERE budget_id = ?`,
        [current.budget_id],
      );
      const next = applyChangeOrderToBudget(
        { totalValue: Number(budgets[0].total_value), clientValue: Number(budgets[0].client_value) },
        Number(current.direct_cost),
      );
      const versionId = randomUUID();
      const versionNumber = Number(versions[0]?.max_version ?? 0) + 1;
      await conn.execute(`UPDATE budget_versions SET is_active = 0 WHERE budget_id = ?`, [current.budget_id]);
      await conn.execute(
        `INSERT INTO budget_versions (id, budget_id, version, is_active, total_value, notes)
         VALUES (?, ?, ?, 1, ?, ?)`,
        [versionId, current.budget_id, versionNumber, next.totalValue,
         `${current.number}: ${current.description}`],
      );
      await conn.execute(
        `UPDATE budgets SET total_value = ?, client_value = ?, active_version_id = ? WHERE id = ?`,
        [next.totalValue, next.clientValue, versionId, current.budget_id],
      );
      await conn.execute(
        `UPDATE budget_change_orders SET status = ?, approved_by = ?, approved_at = ?,
           resulting_version_id = ?
         WHERE id = ? AND status = ?`,
        [decision.target, user.id, ts, versionId, id, current.status],
      );
    });
    return NextResponse.json({ ok: true, status: decision.target });
  } catch (e: any) {
    console.error("[budget-change-orders PATCH]", e?.code, e?.message);
    return NextResponse.json({ error: "Error en la acción" }, { status: 500 });
  }
}
