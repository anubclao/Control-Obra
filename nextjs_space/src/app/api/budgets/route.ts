export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * CRUD: /api/budgets — Presupuestos Tope
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  requireAuth,
  requireRole,
  requireAdmin,
  authFailureResponse,
} from "@/lib/api-auth";
import {
  validateBudgetCommercialTerms,
  type BudgetCommercialTermsInput,
} from "@/lib/budgets-validation";

/** Parsea TEXT JSON tolerante a NULL. Si no es JSON válido, devuelve null. */
function parseJsonOrNull<T>(v: unknown): T | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function r(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    activeVersionId: row.active_version_id,
    totalValue: Number(row.total_value),
    clientValue: Number(row.client_value),
    unforeseenValue: Number(row.unforeseen_value),
    commercialTerms: {
      paymentTerms: parseJsonOrNull(row.payment_terms_json),
      deliveryDays:
        row.delivery_days == null ? null : Number(row.delivery_days),
      offerValidityDays:
        row.offer_validity_days == null
          ? null
          : Number(row.offer_validity_days),
      commercialAdvisor: parseJsonOrNull(row.commercial_advisor_json),
    },
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
    const where = projectId ? "WHERE project_id = ?" : "";
    const args = projectId ? [projectId] : [];
    const rows = await query<any[]>(
      `SELECT * FROM budgets ${where} ORDER BY created_at DESC`,
      args,
    );
    return NextResponse.json(rows.map(r));
  } catch (e: any) {
    console.error("[budgets GET]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(
    "ADMIN",
    "GERENTE",
    "DIRECTOR",
    "RESIDENTE",
    "CONTABILIDAD",
    "TESORERIA",
    "HSEQ",
  );
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.projectId)
      return NextResponse.json(
        { error: "projectId requerido" },
        { status: 400 },
      );

    // Condiciones comerciales opcionales (gap-analysis §3.1).
    // Si el cliente las manda, las validamos; si no, NULL → no rompe.
    const ct = body.commercialTerms as BudgetCommercialTermsInput | undefined;
    if (ct) {
      const v = validateBudgetCommercialTerms(ct);
      if (!v.ok) {
        return NextResponse.json(
          { code: v.code, error: v.error },
          { status: v.status },
        );
      }
    }

    const id = require("crypto").randomUUID();
    const paymentTermsJson = ct?.paymentTerms
      ? JSON.stringify(ct.paymentTerms)
      : null;
    const advisorJson = ct?.commercialAdvisor
      ? JSON.stringify(ct.commercialAdvisor)
      : null;
    const deliveryDays =
      ct?.deliveryDays != null ? Number(ct.deliveryDays) : null;
    const offerValidityDays =
      ct?.offerValidityDays != null ? Number(ct.offerValidityDays) : 30;

    await query(
      `INSERT INTO budgets
         (id, project_id, total_value, client_value, unforeseen_value,
          payment_terms_json, delivery_days, offer_validity_days, commercial_advisor_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.projectId,
        Number(body.totalValue ?? 0),
        Number(body.clientValue ?? 0),
        Number(body.unforeseenValue ?? 0),
        paymentTermsJson,
        deliveryDays,
        offerValidityDays,
        advisorJson,
      ],
    );
    return NextResponse.json({ id, ...body }, { status: 201 });
  } catch (e: any) {
    console.error("[budgets POST]", e?.code, e?.message);
    if (e?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "El proyecto ya tiene presupuesto" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Error al crear presupuesto" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  const auth = await requireRole(
    "ADMIN",
    "GERENTE",
    "DIRECTOR",
    "RESIDENTE",
    "CONTABILIDAD",
    "TESORERIA",
    "HSEQ",
  );
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.id)
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    // Validamos commercialTerms si viene; también aceptamos null explícito
    // para "borrar" el bloque.
    if (body.commercialTerms !== undefined && body.commercialTerms !== null) {
      const v = validateBudgetCommercialTerms(body.commercialTerms);
      if (!v.ok) {
        return NextResponse.json(
          { code: v.code, error: v.error },
          { status: v.status },
        );
      }
    }

    const sets: string[] = [];
    const args: any[] = [];
    for (const [k, c] of Object.entries({
      activeVersionId: "active_version_id",
      totalValue: "total_value",
      clientValue: "client_value",
      unforeseenValue: "unforeseen_value",
    })) {
      if (body[k] !== undefined) {
        sets.push(`${c} = ?`);
        args.push(k === "activeVersionId" ? body[k] : Number(body[k]));
      }
    }

    // Campos comerciales (todos opcionales; null explícito = limpiar).
    if (body.commercialTerms !== undefined) {
      const ct = body.commercialTerms as BudgetCommercialTermsInput | null;
      sets.push("payment_terms_json = ?");
      args.push(ct?.paymentTerms ? JSON.stringify(ct.paymentTerms) : null);
      sets.push("delivery_days = ?");
      args.push(ct?.deliveryDays != null ? Number(ct.deliveryDays) : null);
      sets.push("offer_validity_days = ?");
      args.push(
        ct?.offerValidityDays != null ? Number(ct.offerValidityDays) : 30,
      );
      sets.push("commercial_advisor_json = ?");
      args.push(
        ct?.commercialAdvisor ? JSON.stringify(ct.commercialAdvisor) : null,
      );
    }

    if (!sets.length)
      return NextResponse.json(
        { error: "Nada que actualizar" },
        { status: 400 },
      );
    args.push(body.id);
    await query(`UPDATE budgets SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[budgets PUT]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}
