export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * CRUD: /api/accounting/accounts — Cuentas de tesorería del módulo contable.
 * El saldo actual NO se persiste (se calcula en lib/accounting.ts). AC-10..AC-12.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth, requireRole, requireAdmin, authFailureResponse } from "@/lib/api-auth";
import {
  ACCOUNTING_WRITE_ROLES,
  badRequest,
  money,
  newId,
  serverError,
} from "@/lib/accounting-api";
import type { AccountingAccount } from "@/types";

function toDTO(row: any): AccountingAccount {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    openingBalance: money(row.opening_balance),
    notes: row.notes ?? "",
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

export async function GET() {
  const fail = authFailureResponse(await requireAuth());
  if (fail) return fail;
  try {
    const rows = await query<any[]>(
      "SELECT * FROM accounting_accounts ORDER BY is_active DESC, name ASC",
    );
    return NextResponse.json(rows.map(toDTO));
  } catch (e) {
    return serverError("accounting accounts GET", e);
  }
}

export async function POST(req: Request) {
  const fail = authFailureResponse(await requireRole(...ACCOUNTING_WRITE_ROLES));
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.name) return badRequest("El nombre de la cuenta es obligatorio");
    const id = newId();
    await query(
      `INSERT INTO accounting_accounts (id, name, type, opening_balance, notes, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        String(body.name),
        body.type ?? "CORRIENTE",
        money(body.openingBalance),
        body.notes ?? null,
        body.isActive === false ? 0 : 1,
      ],
    );
    return NextResponse.json({ id, ...body }, { status: 201 });
  } catch (e) {
    return serverError("accounting accounts POST", e);
  }
}

export async function PUT(req: Request) {
  const fail = authFailureResponse(await requireRole(...ACCOUNTING_WRITE_ROLES));
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.id) return badRequest("ID requerido");
    const map: Record<string, string> = {
      name: "name",
      type: "type",
      openingBalance: "opening_balance",
      notes: "notes",
      isActive: "is_active",
    };
    const sets: string[] = [];
    const args: unknown[] = [];
    for (const [key, col] of Object.entries(map)) {
      if (body[key] === undefined) continue;
      sets.push(`${col} = ?`);
      args.push(
        key === "openingBalance"
          ? money(body[key])
          : key === "isActive"
            ? (body[key] ? 1 : 0)
            : body[key],
      );
    }
    if (!sets.length) return badRequest("Sin campos a actualizar");
    args.push(body.id);
    await query(`UPDATE accounting_accounts SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("accounting accounts PUT", e);
  }
}

export async function DELETE(req: Request) {
  const fail = authFailureResponse(await requireAdmin());
  if (fail) return fail;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return badRequest("ID requerido");
    // AC-12: una cuenta con movimientos no se elimina (se desactiva).
    const [incomes, expenses, taxes] = await Promise.all([
      query<any[]>("SELECT 1 FROM accounting_incomes WHERE account_id = ? LIMIT 1", [id]),
      query<any[]>("SELECT 1 FROM accounting_expenses WHERE account_id = ? LIMIT 1", [id]),
      query<any[]>(
        "SELECT 1 FROM accounting_tax_movements WHERE account_id = ? LIMIT 1",
        [id],
      ),
    ]);
    if (incomes.length || expenses.length || taxes.length) {
      return badRequest(
        "La cuenta tiene movimientos asociados. Desactívala en lugar de eliminarla.",
      );
    }
    await query("DELETE FROM accounting_accounts WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("accounting accounts DELETE", e);
  }
}
