/**
 * CRUD: /api/payments — solicitudes de pago con multinivel
 */
import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRANSITIONS: Record<string, string[]> = {
  PENDING: ["APPROVED_LEVEL_1", "REJECTED", "CANCELLED"],
  APPROVED_LEVEL_1: ["APPROVED_LEVEL_2", "REJECTED", "CANCELLED"],
  APPROVED_LEVEL_2: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["PAID", "CANCELLED"],
  REJECTED: [],
  PAID: [],
  CANCELLED: [],
};

const ACTION_STATUS_TARGET: Record<string, string> = {
  APPROVE_L1: "APPROVED_LEVEL_1",
  APPROVE_L2: "APPROVED_LEVEL_2",
  PAY: "PAID",
  REJECT: "REJECTED",
  CANCEL: "CANCELLED",
};

const ACTION_ROLES: Record<string, string[]> = {
  APPROVE_L1: ["DIRECTOR", "ADMIN"],
  APPROVE_L2: ["GERENTE", "ADMIN"],
  PAY: ["TESORERIA", "ADMIN"],
  REJECT: ["DIRECTOR", "GERENTE", "ADMIN"],
  CANCEL: ["TESORERIA", "ADMIN"],
};

function dto(r: any) {
  return {
    id: r.id,
    requestNumber: r.request_number,
    projectId: r.project_id,
    providerId: r.provider_id ?? undefined,
    workCutId: r.work_cut_id ?? undefined,
    type: r.type,
    amount: Number(r.amount),
    priority: r.priority,
    status: r.status,
    currentApprovalLevel: r.current_approval_level,
    requiredApprovalLevel: r.required_approval_level,
    beneficiaryName: r.beneficiary_name,
    beneficiaryNit: r.beneficiary_nit,
    bankName: r.bank_name,
    accountType: r.account_type,
    accountNumber: r.account_number,
    dueDate: r.due_date ?? undefined,
    description: r.description ?? "",
    paidAt: r.paid_at,
    paidReference: r.paid_reference ?? "",
    paidMethod: r.paid_method,
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
    const rows = await query<any[]>(
      `SELECT * FROM payment_requests ${where} ORDER BY created_at DESC`,
      args,
    );
    return NextResponse.json(rows.map(dto));
  } catch (e: any) {
    console.error("[payments GET]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.projectId || !body?.amount || !body?.type ||
        !body?.beneficiaryName || !body?.beneficiaryNit) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 },
      );
    }
    const id = require("crypto").randomUUID();
    const num = `PAG-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    await query(
      `INSERT INTO payment_requests
       (id, request_number, project_id, provider_id, work_cut_id, type, amount,
        priority, status, current_approval_level, required_approval_level,
        beneficiary_name, beneficiary_nit, bank_name, account_type, account_number,
        due_date, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, num, body.projectId, body.providerId ?? null, body.workCutId ?? null,
        body.type, Number(body.amount), body.priority ?? "NORMAL",
        Number(body.requiredApprovalLevel ?? 1),
        body.beneficiaryName, body.beneficiaryNit, body.bankName,
        body.accountType ?? "CHECKING", body.accountNumber,
        body.dueDate ?? null, body.description ?? null,
        body.createdBy ?? "system",
      ],
    );
    return NextResponse.json({ id, ...body, requestNumber: num }, { status: 201 });
  } catch (e: any) {
    console.error("[payments POST]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al crear solicitud" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const map: Record<string, string> = {
      projectId: "project_id", providerId: "provider_id", workCutId: "work_cut_id",
      type: "type", amount: "amount", priority: "priority",
      beneficiaryName: "beneficiary_name", beneficiaryNit: "beneficiary_nit",
      bankName: "bank_name", accountType: "account_type", accountNumber: "account_number",
      dueDate: "due_date", description: "description",
      requiredApprovalLevel: "required_approval_level",
    };
    const sets: string[] = []; const args: any[] = [];
    for (const [k, vCol] of Object.entries(map)) {
      if (body[k] !== undefined) {
        sets.push(`${vCol} = ?`);
        args.push(k === "amount" ? Number(body[k]) : body[k]);
      }
    }
    if (!sets.length) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    args.push(body.id);
    await query(`UPDATE payment_requests SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[payments PUT]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const r = await query<any[]>(`SELECT status FROM payment_requests WHERE id = ?`, [id]);
    if (!r.length) return NextResponse.json({ error: "Solicitud no existe" }, { status: 404 });
    if (!["PENDING", "CANCELLED", "REJECTED"].includes(r[0].status)) {
      return NextResponse.json(
        { error: "Solo se eliminan solicitudes en PENDING, CANCELLED o REJECTED" },
        { status: 400 },
      );
    }
    await query("DELETE FROM payment_requests WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[payments DELETE]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, action, user, comments, rejectionReason, paymentReference, paymentMethod } = body ?? {};
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
    const rows = await query<any[]>(`SELECT status FROM payment_requests WHERE id = ?`, [id]);
    if (!rows.length) return NextResponse.json({ error: "Solicitud no existe" }, { status: 404 });
    const current = rows[0].status;
    const target = ACTION_STATUS_TARGET[action];
    if (!TRANSITIONS[current]?.includes(target)) {
      return NextResponse.json(
        { error: `No se puede pasar de ${current} a ${target}` },
        { status: 400 },
      );
    }
    await transaction(async (conn) => {
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      await conn.execute(
        `UPDATE payment_requests SET
          status = ?,
          paid_at = CASE WHEN ? = 'PAY' THEN ? ELSE paid_at END,
          paid_reference = CASE WHEN ? = 'PAY' THEN ? ELSE paid_reference END,
          paid_method = CASE WHEN ? = 'PAY' THEN ? ELSE paid_method END,
          current_approval_level = CASE
            WHEN ? IN ('APPROVE_L1','APPROVE_L2') THEN current_approval_level + 1
            ELSE current_approval_level END,
          rejection_reason = CASE WHEN ? = 'REJECT' THEN ? ELSE rejection_reason END
         WHERE id = ?`,
        [
          target,
          action, now,
          action, paymentReference ?? null,
          action, paymentMethod ?? null,
          action,
          action, rejectionReason ?? null,
          id,
        ],
      );
      await conn.execute(
        `INSERT INTO payment_approvals
         (id, payment_id, action, level, user_id, user_name, user_role, comments,
          payment_reference, payment_method)
         VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, action,
         action === "APPROVE_L1" ? 1 : action === "APPROVE_L2" ? 2 : null,
         user.id ?? "unknown", user.name ?? "Anónimo", user.role,
         comments ?? null,
         paymentReference ?? null, paymentMethod ?? null,
        ],
      );
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[payments PATCH/action]", e?.code, e?.message);
    return NextResponse.json({ error: "Error en acción" }, { status: 500 });
  }
}
