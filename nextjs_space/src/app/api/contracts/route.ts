export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * CRUD: /api/contracts
 *
 * Auth:
 *   GET    → requireAuth
 *   POST   → requireRole("ADMIN","GERENTE","DIRECTOR","RESIDENTE")
 *   PUT    → requireRole(idem)
 *   DELETE → requireAdmin
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  requireAuth,
  requireRole,
  requireAdmin,
  authFailureResponse,
} from "@/lib/api-auth";
import { validatePricingMode } from "@/lib/contracts-constants";

function r(row: any) {
  return {
    id: row.id,
    contractNumber: row.contract_number,
    projectId: row.project_id,
    providerId: row.provider_id,
    type: row.type,
    value: Number(row.value),
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    scopeOfWork: row.scope_of_work,
    retentionPercent: Number(row.retention_percent),
    advancePercent: Number(row.advance_percent),
    pricingMode: row.pricing_mode ?? "UNIT_PRICE",
    notes: row.notes ?? "",
    createdAt: row.created_at,
    createdBy: row.created_by,
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
      `SELECT * FROM contracts ${where} ORDER BY created_at DESC`,
      args,
    );
    return NextResponse.json(rows.map(r));
  } catch (e: any) {
    console.error("[contracts GET]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

async function nextContractNumber(): Promise<string> {
  const y = new Date().getFullYear();
  const prefix = `CTR-${y}-`;
  // P0 plan 2026-10-04: antes era CTR-${y}-${Date.now().base36} que era opaco.
  // Usamos MAX(...)+1 sobre contract_number LIKE 'CTR-YYYY-%' para generar
  // CTR-2026-0001, CTR-2026-0002, etc. MAX (no COUNT) tolera huecos y
  // es seguro en condiciones de inserciones concurrentes.
  const rows = await query<any[]>(
    `SELECT contract_number FROM contracts
       WHERE contract_number LIKE ?
       ORDER BY contract_number DESC
       LIMIT 1`,
    [`${prefix}%`],
  );
  let nextSeq = 1;
  if (rows.length > 0) {
    const last = String(rows[0].contract_number ?? "");
    const m = last.match(/^CTR-\d{4}-(\d{4})$/);
    if (m) nextSeq = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN", "GERENTE", "DIRECTOR", "RESIDENTE");
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (
      !body?.projectId ||
      !body?.providerId ||
      !body?.value ||
      !body?.type ||
      !body?.startDate ||
      !body?.endDate ||
      !body?.scopeOfWork
    ) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 },
      );
    }

    // Modalidad de contratación (gap-analysis §3.3). Opcional, default UNIT_PRICE.
    const pm = validatePricingMode(body.pricingMode);
    if (!pm.ok) {
      return NextResponse.json(
        { code: pm.code, error: pm.error },
        { status: pm.status },
      );
    }
    const pricingMode = pm.value;

    const id = randomUUID();
    const number = body.contractNumber ?? (await nextContractNumber());
    await query(
      `INSERT INTO contracts
       (id, contract_number, project_id, provider_id, type, value,
        start_date, end_date, status, scope_of_work, retention_percent,
        advance_percent, pricing_mode, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        number,
        body.projectId,
        body.providerId,
        body.type,
        Number(body.value),
        body.startDate,
        body.endDate,
        body.status ?? "DRAFT",
        body.scopeOfWork,
        Number(body.retentionPercent ?? 0),
        Number(body.advancePercent ?? 0),
        pricingMode,
        body.notes ?? null,
        body.createdBy ?? null,
      ],
    );
    return NextResponse.json(
      { id, ...body, contractNumber: number, pricingMode },
      { status: 201 },
    );
  } catch (e: any) {
    console.error("[contracts POST]", e?.code, e?.message);
    if (e?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "Ya existe un contrato con ese número" },
        { status: 409 },
      );
    }
    if (e?.code === "ER_NO_REFERENCED_ROW_2") {
      return NextResponse.json(
        { error: "Proyecto o proveedor no existe" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Error al crear contrato" },
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
    if (!body?.id)
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const map: Record<string, string> = {
      projectId: "project_id",
      providerId: "provider_id",
      type: "type",
      value: "value",
      startDate: "start_date",
      endDate: "end_date",
      status: "status",
      scopeOfWork: "scope_of_work",
      retentionPercent: "retention_percent",
      advancePercent: "advance_percent",
      notes: "notes",
    };
    const sets: string[] = [];
    const args: any[] = [];
    for (const [k, vCol] of Object.entries(map)) {
      if (body[k] !== undefined) {
        sets.push(`${vCol} = ?`);
        args.push(
          ["value", "retentionPercent", "advancePercent"].includes(k)
            ? Number(body[k])
            : body[k],
        );
      }
    }
    if (body.pricingMode !== undefined) {
      const pm = validatePricingMode(body.pricingMode);
      if (!pm.ok) {
        return NextResponse.json(
          { code: pm.code, error: pm.error },
          { status: pm.status },
        );
      }
      sets.push("pricing_mode = ?");
      args.push(pm.value);
    }
    if (!sets.length)
      return NextResponse.json(
        { error: "Nada que actualizar" },
        { status: 400 },
      );
    args.push(body.id);
    await query(`UPDATE contracts SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[contracts PUT]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id)
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    await query("DELETE FROM contracts WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[contracts DELETE]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
