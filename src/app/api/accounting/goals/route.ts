export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * /api/accounting/goals — Metas mensuales por alcance (proyecto o General).
 * Es un upsert: cada alcance tiene como máximo una meta (AC-18).
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth, requireRole, authFailureResponse } from "@/lib/api-auth";
import {
  ACCOUNTING_WRITE_ROLES,
  money,
  newId,
  normalizeProjectId,
  serverError,
} from "@/lib/accounting-api";
import type { AccountingGoal } from "@/types";

const GENERAL_KEY = "__GENERAL__";

function toDTO(row: any): AccountingGoal {
  return {
    id: row.id,
    projectId: row.project_id,
    monthlyIncome: money(row.monthly_income),
    maxExpense: money(row.max_expense),
    monthlySavings: money(row.monthly_savings),
  };
}

export async function GET() {
  const fail = authFailureResponse(await requireAuth());
  if (fail) return fail;
  try {
    const rows = await query<any[]>("SELECT * FROM accounting_goals");
    return NextResponse.json(rows.map(toDTO));
  } catch (e) {
    return serverError("accounting goals GET", e);
  }
}

export async function PUT(req: Request) {
  const fail = authFailureResponse(await requireRole(...ACCOUNTING_WRITE_ROLES));
  if (fail) return fail;
  try {
    const body = await req.json();
    const projectId = normalizeProjectId(body?.projectId);
    const scopeKey = projectId ?? GENERAL_KEY;
    const values = {
      monthlyIncome: money(body?.monthlyIncome),
      maxExpense: money(body?.maxExpense),
      monthlySavings: money(body?.monthlySavings),
    };
    if (
      values.monthlyIncome < 0 ||
      values.maxExpense < 0 ||
      values.monthlySavings < 0
    ) {
      return NextResponse.json({ error: "Las metas no pueden ser negativas" }, { status: 400 });
    }
    await query(
      `INSERT INTO accounting_goals
        (id, project_id, scope_key, monthly_income, max_expense, monthly_savings)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         monthly_income = VALUES(monthly_income),
         max_expense = VALUES(max_expense),
         monthly_savings = VALUES(monthly_savings)`,
      [
        newId(),
        projectId,
        scopeKey,
        values.monthlyIncome,
        values.maxExpense,
        values.monthlySavings,
      ],
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("accounting goals PUT", e);
  }
}

/** POST delega en PUT: el cliente puede usar cualquiera de los dos. */
export const POST = PUT;
