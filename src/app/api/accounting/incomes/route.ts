export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * CRUD: /api/accounting/incomes — Ingresos del módulo contable.
 * Valida el workflow POR_PAGAR → PAGADO en el servidor (AC-3..AC-5).
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth, requireRole, requireAdmin, authFailureResponse } from "@/lib/api-auth";
import {
  ACCOUNTING_WRITE_ROLES,
  badRequest,
  isoDate,
  money,
  newId,
  normalizeProjectId,
  scopeFilter,
  serverError,
} from "@/lib/accounting-api";
import { canTransitionIncome, validateIncome } from "@/lib/accounting-constants";
import { incomeNetAmount } from "@/lib/accounting";
import type { AccountingIncome } from "@/types";

function toDTO(row: any): AccountingIncome {
  return {
    id: row.id,
    date: isoDate(row.date),
    projectId: row.project_id,
    costCenter: row.cost_center ?? "",
    creator: row.creator ?? "",
    clientName: row.client_name ?? "",
    invoice: row.invoice ?? "",
    amount: money(row.amount),
    taxes: money(row.taxes),
    status: row.status,
    accountId: row.account_id,
    paidAmount: row.paid_amount != null ? money(row.paid_amount) : null,
    createdAt: row.created_at,
  };
}

export async function GET(req: Request) {
  const fail = authFailureResponse(await requireAuth());
  if (fail) return fail;
  try {
    const { where, args } = scopeFilter(new URL(req.url).searchParams);
    const rows = await query<any[]>(
      `SELECT * FROM accounting_incomes ${where} ORDER BY date DESC, created_at DESC`,
      args,
    );
    return NextResponse.json(rows.map(toDTO));
  } catch (e) {
    return serverError("accounting incomes GET", e);
  }
}

export async function POST(req: Request) {
  const fail = authFailureResponse(await requireRole(...ACCOUNTING_WRITE_ROLES));
  if (fail) return fail;
  try {
    const body = await req.json();
    const draft = {
      date: body?.date,
      amount: money(body?.amount),
      taxes: money(body?.taxes),
      status: body?.status ?? "POR_PAGAR",
      accountId: body?.accountId || null,
      paidAmount: body?.paidAmount != null && body.paidAmount !== "" ? money(body.paidAmount) : null,
    };
    const check = validateIncome(draft);
    if (!check.ok) return badRequest(check.error!);

    const id = newId();
    const paid =
      draft.status === "PAGADO"
        ? (draft.paidAmount ?? incomeNetAmount({ amount: draft.amount, taxes: draft.taxes }))
        : null;
    await query(
      `INSERT INTO accounting_incomes
        (id, date, project_id, cost_center, creator, client_name, invoice,
         amount, taxes, status, account_id, paid_amount, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        draft.date,
        normalizeProjectId(body?.projectId),
        body?.costCenter ?? "",
        body?.creator ?? "",
        body?.clientName ?? "",
        body?.invoice ?? "",
        draft.amount,
        draft.taxes,
        draft.status,
        draft.accountId,
        paid,
        body?.createdBy ?? null,
      ],
    );
    return NextResponse.json({ id, ...body }, { status: 201 });
  } catch (e) {
    return serverError("accounting incomes POST", e);
  }
}

export async function PUT(req: Request) {
  const fail = authFailureResponse(await requireRole(...ACCOUNTING_WRITE_ROLES));
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.id) return badRequest("ID requerido");
    const current = await query<any[]>("SELECT * FROM accounting_incomes WHERE id = ?", [
      body.id,
    ]);
    if (!current.length) return NextResponse.json({ error: "No existe" }, { status: 404 });
    const before = toDTO(current[0]);

    const after: AccountingIncome = {
      ...before,
      ...(body.date !== undefined ? { date: body.date } : {}),
      ...(body.amount !== undefined ? { amount: money(body.amount) } : {}),
      ...(body.taxes !== undefined ? { taxes: money(body.taxes) } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.accountId !== undefined ? { accountId: body.accountId || null } : {}),
      ...(body.paidAmount !== undefined
        ? { paidAmount: body.paidAmount === "" || body.paidAmount == null ? null : money(body.paidAmount) }
        : {}),
    };
    if (!canTransitionIncome(before.status, after.status)) {
      return badRequest(
        `No se permite pasar de ${before.status} a ${after.status}`,
      );
    }
    const check = validateIncome(after);
    if (!check.ok) return badRequest(check.error!);

    const map: Record<string, string> = {
      date: "date",
      costCenter: "cost_center",
      creator: "creator",
      clientName: "client_name",
      invoice: "invoice",
      amount: "amount",
      taxes: "taxes",
      status: "status",
      accountId: "account_id",
      paidAmount: "paid_amount",
    };
    const sets: string[] = [];
    const args: unknown[] = [];
    for (const [key, col] of Object.entries(map)) {
      if (body[key] === undefined) continue;
      sets.push(`${col} = ?`);
      args.push((after as any)[key] ?? null);
    }
    if (body.projectId !== undefined) {
      sets.push("project_id = ?");
      args.push(normalizeProjectId(body.projectId));
    }
    // Al marcar PAGADO sin valor explícito, se asume el valor final.
    if (after.status === "PAGADO" && after.paidAmount == null) {
      sets.push("paid_amount = ?");
      args.push(incomeNetAmount(after));
    }
    if (!sets.length) return badRequest("Sin campos a actualizar");
    args.push(body.id);
    await query(`UPDATE accounting_incomes SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("accounting incomes PUT", e);
  }
}

export async function DELETE(req: Request) {
  const fail = authFailureResponse(await requireAdmin());
  if (fail) return fail;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return badRequest("ID requerido");
    const rows = await query<any[]>("SELECT status FROM accounting_incomes WHERE id = ?", [
      id,
    ]);
    if (!rows.length) return NextResponse.json({ error: "No existe" }, { status: 404 });
    if (rows[0].status === "PAGADO") {
      return badRequest("No se puede eliminar un ingreso ya cobrado");
    }
    await query("DELETE FROM accounting_incomes WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("accounting incomes DELETE", e);
  }
}
