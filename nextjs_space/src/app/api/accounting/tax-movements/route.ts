export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * CRUD: /api/accounting/tax-movements — Impuestos declarados/pagados.
 * Las TASAS siguen en /api/taxes (tax_configs); esto son movimientos (AC-13, AC-14).
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth, requireRole, requireAdmin, authFailureResponse, type AuthSuccess } from "@/lib/api-auth";
import {
  ACCOUNTING_WRITE_ROLES,
  badRequest,
  isoDate,
  money,
  newId,
  normalizeProjectId,
  scopeFilter,
  serverError,
  assertAccountActive,
  assertProjectExists,
} from "@/lib/accounting-api";
import { canTransitionTaxMovement, validateTaxMovement } from "@/lib/accounting-constants";
import type { AccountingTaxMovement } from "@/types";

function toDTO(row: any): AccountingTaxMovement {
  return {
    id: row.id,
    date: isoDate(row.date),
    projectId: row.project_id,
    authority: row.authority ?? "",
    description: row.description ?? "",
    amount: money(row.amount),
    status: row.status,
    accountId: row.account_id,
    // P0 plan 2026-10-02: exponer tax_type para filtrar/reportes.
    taxType: row.tax_type ?? null,
    createdAt: row.created_at,
  };
}

export async function GET(req: Request) {
  const fail = authFailureResponse(await requireAuth());
  if (fail) return fail;
  try {
    const { where, args } = scopeFilter(new URL(req.url).searchParams);
    const rows = await query<any[]>(
      `SELECT * FROM accounting_tax_movements ${where} ORDER BY date DESC, created_at DESC`,
      args,
    );
    return NextResponse.json(rows.map(toDTO));
  } catch (e) {
    return serverError("accounting tax-movements GET", e);
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(...ACCOUNTING_WRITE_ROLES);
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    const draft = {
      date: body?.date,
      amount: money(body?.amount),
      status: body?.status ?? "DECLARADO",
      accountId: body?.accountId || null,
    };
    const check = validateTaxMovement(draft);
    if (!check.ok) return badRequest(check.error!);
    if (!body?.description) return badRequest("La descripción es obligatoria");

    // P0 plan 2026-10-02 (Fase 2.1+2.2): pre-check de FK.
    if (draft.accountId) {
      const okAcc = await assertAccountActive(draft.accountId);
      if (okAcc.ok === false) return badRequest(okAcc.error);
    }
    const projectId = normalizeProjectId(body?.projectId);
    if (projectId) {
      const okProj = await assertProjectExists(projectId);
      if (okProj.ok === false) return badRequest(okProj.error);
    }

    const id = newId();
    await query(
      `INSERT INTO accounting_tax_movements
        (id, date, project_id, authority, description, tax_type,
         amount, status, account_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        draft.date,
        projectId,
        body?.authority ?? "DIAN",
        body.description,
        body?.taxType ?? null,
        draft.amount,
        draft.status,
        draft.accountId,
        // P0 plan 2026-10-02 (Fase 1.5): created_by desde sesion.
        (auth as AuthSuccess).userId,
      ],
    );
    return NextResponse.json({ id, ...body }, { status: 201 });
  } catch (e) {
    return serverError("accounting tax-movements POST", e);
  }
}

export async function PUT(req: Request) {
  const fail = authFailureResponse(await requireRole(...ACCOUNTING_WRITE_ROLES));
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.id) return badRequest("ID requerido");
    const current = await query<any[]>(
      "SELECT * FROM accounting_tax_movements WHERE id = ?",
      [body.id],
    );
    if (!current.length) return NextResponse.json({ error: "No existe" }, { status: 404 });
    const before = toDTO(current[0]);

    const after: AccountingTaxMovement = {
      ...before,
      ...(body.date !== undefined ? { date: body.date } : {}),
      ...(body.amount !== undefined ? { amount: money(body.amount) } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.accountId !== undefined ? { accountId: body.accountId || null } : {}),
    };
    if (!canTransitionTaxMovement(before.status, after.status)) {
      return badRequest(`No se permite pasar de ${before.status} a ${after.status}`);
    }
    const check = validateTaxMovement(after);
    if (!check.ok) return badRequest(check.error!);

    const map: Record<string, string> = {
      date: "date",
      authority: "authority",
      description: "description",
      amount: "amount",
      status: "status",
      accountId: "account_id",
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
    if (!sets.length) return badRequest("Sin campos a actualizar");
    args.push(body.id);
    await query(
      `UPDATE accounting_tax_movements SET ${sets.join(", ")} WHERE id = ?`,
      args,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("accounting tax-movements PUT", e);
  }
}

export async function DELETE(req: Request) {
  const fail = authFailureResponse(await requireAdmin());
  if (fail) return fail;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return badRequest("ID requerido");
    const rows = await query<any[]>(
      "SELECT status FROM accounting_tax_movements WHERE id = ?",
      [id],
    );
    if (!rows.length) return NextResponse.json({ error: "No existe" }, { status: 404 });
    if (rows[0].status === "PAGADO") {
      return badRequest("No se puede eliminar un impuesto ya pagado");
    }
    await query("DELETE FROM accounting_tax_movements WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("accounting tax-movements DELETE", e);
  }
}
