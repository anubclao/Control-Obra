/**
 * CRUD: /api/cuts (work_cuts)
 * Reglas de transición (PDF p.21):
 *   DRAFT → SUBMITTED → VALIDATED → APPROVED → PAID
 *                              ↘ REJECTED → (re-edita como nuevo borrador)
 */
import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["VALIDATED", "REJECTED"],
  VALIDATED: ["APPROVED", "REJECTED"],
  APPROVED: ["PAID"],
  REJECTED: ["DRAFT"],
  PAID: [],
};

const ACTION_ROLES: Record<string, string[]> = {
  SUBMIT: ["RESIDENTE", "DIRECTOR", "ADMIN"],
  VALIDATE: ["DIRECTOR", "ADMIN"],
  APPROVE: ["ADMIN"],
  REJECT: ["ADMIN", "DIRECTOR", "GERENTE"],
  PAY: ["TESORERIA", "ADMIN"],
};

const ACTION_TARGET: Record<string, string> = {
  SUBMIT: "SUBMITTED",
  VALIDATE: "VALIDATED",
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  PAY: "PAID",
};

function cutDto(r: any) {
  return {
    id: r.id,
    cutNumber: r.cut_number,
    projectId: r.project_id,
    providerId: r.provider_id,
    description: r.description,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    grossValue: Number(r.gross_value),
    retentionPercent: Number(r.retention_percent),
    retentionValue: Number(r.retention_value),
    advanceDeduction: Number(r.advance_deduction),
    netValue: Number(r.net_value),
    status: r.status,
    submittedAt: r.submitted_at,
    validatedAt: r.validated_at,
    approvedAt: r.approved_at,
    paidAt: r.paid_at,
    rejectionReason: r.rejection_reason ?? "",
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const status = url.searchParams.get("status");
    const conds: string[] = [];
    const args: any[] = [];
    if (projectId) { conds.push("project_id = ?"); args.push(projectId); }
    if (status) { conds.push("status = ?"); args.push(status); }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const [cuts, items, docs] = await Promise.all([
      query<any[]>(`SELECT * FROM work_cuts ${where} ORDER BY created_at DESC`, args),
      query<any[]>(`SELECT * FROM work_cut_items`),
      query<any[]>(`SELECT * FROM work_cut_documents`),
    ]);
    const itemsByCut: Record<string, any[]> = {};
    for (const it of items) {
      (itemsByCut[it.work_cut_id] ??= []).push({
        id: it.id,
        description: it.description,
        unit: it.unit,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unit_price),
        totalPrice: Number(it.total_price),
        budgetItemCode: it.budget_item_code ?? undefined,
      });
    }
    const docsByCut: Record<string, any[]> = {};
    for (const d of docs) {
      (docsByCut[d.work_cut_id] ??= []).push({
        id: d.id,
        type: d.type,
        fileName: d.file_name,
        uploadedAt: d.uploaded_at,
      });
    }
    return NextResponse.json(
      cuts.map((c) => ({
        ...cutDto(c),
        items: itemsByCut[c.id] ?? [],
        documents: docsByCut[c.id] ?? [],
      })),
    );
  } catch (e: any) {
    console.error("[cuts GET]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.projectId || !body?.providerId || !body?.description ||
        !body?.periodStart || !body?.periodEnd) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 },
      );
    }
    const id = require("crypto").randomUUID();
    const num = `CO-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    await transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO work_cuts
         (id, cut_number, project_id, provider_id, description, period_start, period_end,
          gross_value, retention_percent, retention_value, advance_deduction, net_value,
          status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
        [
          id, num, body.projectId, body.providerId, body.description,
          body.periodStart, body.periodEnd,
          Number(body.grossValue ?? 0),
          Number(body.retentionPercent ?? 0),
          Number(body.retentionValue ?? 0),
          Number(body.advanceDeduction ?? 0),
          Number(body.netValue ?? 0),
          body.createdBy ?? "system",
        ],
      );
      const items = Array.isArray(body.items) ? body.items : [];
      for (const it of items) {
        await conn.execute(
          `INSERT INTO work_cut_items
           (id, work_cut_id, description, unit, quantity, unit_price,
            total_price, budget_item_code)
           VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, it.description, it.unit,
            Number(it.quantity ?? 0), Number(it.unitPrice ?? 0),
            Number(it.totalPrice ?? Number(it.quantity ?? 0) * Number(it.unitPrice ?? 0)),
            it.budgetItemCode ?? null,
          ],
        );
      }
    });
    return NextResponse.json({ id, ...body, cutNumber: num }, { status: 201 });
  } catch (e: any) {
    console.error("[cuts POST]", e?.code, e?.message);
    if (e?.code === "ER_NO_REFERENCED_ROW_2") {
      return NextResponse.json(
        { error: "Proyecto o proveedor no existe" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Error al crear corte" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const map: Record<string, string> = {
      projectId: "project_id",
      providerId: "provider_id",
      description: "description",
      periodStart: "period_start",
      periodEnd: "period_end",
      grossValue: "gross_value",
      retentionPercent: "retention_percent",
      retentionValue: "retention_value",
      advanceDeduction: "advance_deduction",
      netValue: "net_value",
      status: "status",
      rejectionReason: "rejection_reason",
    };
    const sets: string[] = [];
    const args: any[] = [];
    for (const [k, vCol] of Object.entries(map)) {
      if (body[k] !== undefined) {
        sets.push(`${vCol} = ?`);
        args.push(
          ["grossValue", "retentionPercent", "retentionValue", "advanceDeduction", "netValue"].includes(k)
            ? Number(body[k]) : body[k],
        );
      }
    }
    if (sets.length) {
      args.push(body.id);
      await query(`UPDATE work_cuts SET ${sets.join(", ")} WHERE id = ?`, args);
    }
    // Reemplazar items si se proporcionan completos
    if (Array.isArray(body.items)) {
      await transaction(async (conn) => {
        await conn.execute(`DELETE FROM work_cut_items WHERE work_cut_id = ?`, [body.id]);
        for (const it of body.items) {
          await conn.execute(
            `INSERT INTO work_cut_items
             (id, work_cut_id, description, unit, quantity, unit_price, total_price, budget_item_code)
             VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
            [body.id, it.description, it.unit, Number(it.quantity), Number(it.unitPrice),
             Number(it.totalPrice), it.budgetItemCode ?? null],
          );
        }
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[cuts PUT]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    // Solo se pueden eliminar cortes en DRAFT o REJECTED
    const r = await query<any[]>(`SELECT status FROM work_cuts WHERE id = ?`, [id]);
    if (!r.length) return NextResponse.json({ error: "Corte no existe" }, { status: 404 });
    if (!["DRAFT", "REJECTED"].includes(r[0].status)) {
      return NextResponse.json(
        { error: "Solo se pueden eliminar cortes en borrador o rechazados" },
        { status: 400 },
      );
    }
    await query("DELETE FROM work_cuts WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[cuts DELETE]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}

/**
 * POST /api/cuts/action { id, action, user, comments?, rejectionReason? }
 * Aplica reglas de transición + permisos por rol.
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, action, user, comments, rejectionReason } = body ?? {};
    if (!id || !action || !user?.role) {
      return NextResponse.json({ error: "id, action, user requeridos" }, { status: 400 });
    }
    const allowed = ACTION_ROLES[action];
    if (!allowed || !allowed.includes(user.role)) {
      return NextResponse.json(
        { error: `Tu rol (${user.role}) no puede ejecutar ${action}` },
        { status: 403 },
      );
    }
    if (action === "REJECT" && !rejectionReason?.trim()) {
      return NextResponse.json(
        { error: "El motivo del rechazo es obligatorio" },
        { status: 400 },
      );
    }
    const rows = await query<any[]>(`SELECT status FROM work_cuts WHERE id = ?`, [id]);
    if (!rows.length) return NextResponse.json({ error: "Corte no existe" }, { status: 404 });
    const current = rows[0].status;
    const target = ACTION_TARGET[action];
    if (!TRANSITIONS[current]?.includes(target)) {
      return NextResponse.json(
        { error: `No se puede pasar de ${current} a ${target}` },
        { status: 400 },
      );
    }
    await transaction(async (conn) => {
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      await conn.execute(
        `UPDATE work_cuts SET status = ?, rejection_reason = ?,
            submitted_at = CASE WHEN ? = 'SUBMIT'  THEN ? ELSE submitted_at END,
            validated_at = CASE WHEN ? = 'VALIDATE' THEN ? ELSE validated_at END,
            approved_at  = CASE WHEN ? = 'APPROVE' THEN ? ELSE approved_at END,
            paid_at      = CASE WHEN ? = 'PAY' THEN ? ELSE paid_at END
         WHERE id = ?`,
        [
          target,
          action === "REJECT" ? rejectionReason : null,
          action, now, action, now, action, now, action, now,
          id,
        ],
      );
      await conn.execute(
        `INSERT INTO work_cut_approvals
         (id, work_cut_id, action, user_id, user_name, user_role, comments)
         VALUES (UUID(), ?, ?, ?, ?, ?, ?)`,
        [id, action, user.id ?? "unknown", user.name ?? "Anónimo", user.role, comments ?? null],
      );
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[cuts PATCH/action]", e?.code, e?.message);
    return NextResponse.json({ error: "Error en transición" }, { status: 500 });
  }
}
