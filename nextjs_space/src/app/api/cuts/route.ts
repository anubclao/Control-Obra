export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * CRUD: /api/cuts (work_cuts)
 * Reglas de transición (PDF p.21):
 *   DRAFT → SUBMITTED → VALIDATED → APPROVED → PAID
 *                              ↘ REJECTED → (re-edita como nuevo borrador)
 *
 * Totales (bruto, retención, neto) se calculan SIEMPRE aquí con
 * computeCutTotals; el estado solo cambia vía PATCH (workflow) y el rol sale
 * de la sesión. Spec: docs/specs/bug-cortes-pagos-integridad.md
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import {
  requireAuth,
  requireRole,
  requireAdmin,
  authFailureResponse,
  type AuthSuccess,
} from "@/lib/api-auth";
import {
  evaluateCutAction,
  computeCutTotals,
  isCutEditable,
} from "@/lib/cuts-workflow";
import { cutMonetarySchema } from "@/lib/validators/numeric";
import { syncExpenseOnPayment, syncExpenseOnCutApprove } from "@/lib/accounting-integration";
import {
  parsePagination,
  pageToLimitOffset,
  paginationMeta,
  groupByIds,
} from "@/lib/validators/api";
import { can } from "@/lib/permissions-matrix";

type CutItemInput = {
  description?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  budgetItemCode?: string;
};

function parseItems(raw: unknown): CutItemInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((it: any) => ({
    description: it?.description,
    unit: it?.unit,
    quantity: Number(it?.quantity ?? 0),
    unitPrice: Number(it?.unitPrice ?? 0),
    budgetItemCode: it?.budgetItemCode,
  }));
}

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

/**
 * P0 plan 2026-10-04: renumerar cortes a CO-YYYY-NNNN (mismo patron
 * que PSC y Contract). MAX+1 sobre contract_number LIKE 'CO-YYYY-%'.
 */
async function nextCutNumber(): Promise<string> {
  const y = new Date().getFullYear();
  const prefix = `CO-${y}-`;
  const rows = await query<any[]>(
    `SELECT cut_number FROM work_cuts
       WHERE cut_number LIKE ?
       ORDER BY cut_number DESC
       LIMIT 1`,
    [`${prefix}%`],
  );
  let nextSeq = 1;
  if (rows.length > 0) {
    const last = String(rows[0].cut_number ?? "");
    const m = last.match(/^CO-\d{4}-(\d{4})$/);
    if (m) nextSeq = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  // P0 (seccion 4.4): gate por matriz. CLIENTE/USER -> 403.
  if (!can((auth as any).user.role, "cuts", "read")) {
    return NextResponse.json(
      { error: "No tienes permisos para ver cortes" },
      { status: 403 },
    );
  }
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const status = url.searchParams.get("status");
    const conds: string[] = ["deleted_at IS NULL"];
    const args: any[] = [];
    if (projectId) {
      conds.push("project_id = ?");
      args.push(projectId);
    }
    if (status) {
      conds.push("status = ?");
      args.push(status);
    }
    const where = `WHERE ${conds.join(" AND ")}`;

    // P2 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.2):
    //   Antes se leian TODAS las filas de work_cuts, work_cut_items y
    //   work_cut_documents en cada llamada. Ahora la lista se pagina
    //   (page/limit) y los hijos se traen solo para los ids de la
    //   pagina actual con WHERE work_cut_id IN (...).
    const pagination = parsePagination(url);
    const { limit, offset } = pageToLimitOffset(pagination);
    const [cuts, totalRow] = await Promise.all([
      query<any[]>(
        `SELECT * FROM work_cuts ${where}
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      ),
      query<any[]>(`SELECT COUNT(*) AS total FROM work_cuts ${where}`, args),
    ]);
    const total = Number(totalRow[0]?.total ?? 0);
    const cutIds = cuts.map((c) => c.id);
    const placeholders = cutIds.map(() => "?").join(",");
    const [items, docs] = cutIds.length
      ? await Promise.all([
          query<any[]>(
            `SELECT * FROM work_cut_items WHERE work_cut_id IN (${placeholders})`,
            cutIds,
          ),
          query<any[]>(
            `SELECT * FROM work_cut_documents WHERE work_cut_id IN (${placeholders})`,
            cutIds,
          ),
        ])
      : [[], []];
    const itemsByCut = groupByIds(items as any[], "work_cut_id");
    const docsByCut = groupByIds(docs as any[], "work_cut_id");
    return NextResponse.json({
      data: cuts.map((c) => ({
        ...cutDto(c),
        items: (itemsByCut[c.id] ?? []).map((it) => ({
          id: it.id,
          description: it.description,
          unit: it.unit,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unit_price),
          totalPrice: Number(it.total_price),
          budgetItemCode: it.budget_item_code ?? undefined,
        })),
        documents: (docsByCut[c.id] ?? []).map((d) => ({
          id: d.id,
          type: d.type,
          fileName: d.file_name,
          uploadedAt: d.uploaded_at,
        })),
      })),
      pagination: paginationMeta(total, pagination),
    });
  } catch (e: any) {
    console.error("[cuts GET]", e?.code, e?.message);
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
    if (
      !body?.projectId ||
      !body?.providerId ||
      !body?.description ||
      !body?.periodStart ||
      !body?.periodEnd
    ) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 },
      );
    }
    const createdBy = (auth as AuthSuccess).userId;
    const retentionPercent = Number(body.retentionPercent ?? 0);
    const advanceDeduction = Number(body.advanceDeduction ?? 0);

    // P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.1):
    //   Validamos con Zod que la retencion este en [0,100] y el anticipo
    //   sea >= 0. Tambien verificamos que el anticipo no supere el
    //   bruto, que era otro caso del bug de integridad.
    const monetaryValidation = cutMonetarySchema.safeParse({
      retentionPercent,
      advanceDeduction,
    });
    if (!monetaryValidation.success) {
      return NextResponse.json(
        {
          error:
            monetaryValidation.error.issues[0]?.message ??
            "Valores monetarios invalidos",
          code: "INVALID_CUT_VALUES",
        },
        { status: 400 },
      );
    }
    const totals = computeCutTotals(
      parseItems(body.items),
      retentionPercent,
      advanceDeduction,
    );
    const id = randomUUID();
    const num = body.cutNumber ?? (await nextCutNumber());
    await transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO work_cuts
         (id, cut_number, project_id, provider_id, description, period_start, period_end,
          gross_value, retention_percent, retention_value, advance_deduction, net_value,
          status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
        [
          id,
          num,
          body.projectId,
          body.providerId,
          body.description,
          body.periodStart,
          body.periodEnd,
          totals.grossValue,
          retentionPercent,
          totals.retentionValue,
          advanceDeduction,
          totals.netValue,
          createdBy,
        ],
      );
      for (const it of totals.items) {
        await conn.execute(
          `INSERT INTO work_cut_items
           (id, work_cut_id, description, unit, quantity, unit_price,
            total_price, budget_item_code)
           VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            it.description,
            it.unit,
            it.quantity,
            it.unitPrice,
            it.totalPrice,
            it.budgetItemCode ?? null,
          ],
        );
      }
    });
    return NextResponse.json(
      {
        id,
        ...body,
        cutNumber: num,
        createdBy,
        items: totals.items,
        grossValue: totals.grossValue,
        retentionValue: totals.retentionValue,
        netValue: totals.netValue,
      },
      { status: 201 },
    );
  } catch (e: any) {
    console.error("[cuts POST]", e?.code, e?.message);
    if (e?.code === "ER_NO_REFERENCED_ROW_2") {
      return NextResponse.json(
        { error: "Proyecto o proveedor no existe" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Error al crear corte" },
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

    const current = await query<any[]>(
      `SELECT status, retention_percent, advance_deduction FROM work_cuts WHERE id = ?`,
      [body.id],
    );
    if (!current.length)
      return NextResponse.json({ error: "Corte no existe" }, { status: 404 });
    if (!isCutEditable(current[0].status)) {
      return NextResponse.json(
        {
          error: "Solo se pueden editar cortes en borrador o rechazados",
          code: "CUT_NOT_EDITABLE",
        },
        { status: 409 },
      );
    }

    // status, rejectionReason y totales NO se aceptan del body: el estado
    // cambia vía PATCH (workflow) y los totales se recalculan abajo.
    const map: Record<string, string> = {
      projectId: "project_id",
      providerId: "provider_id",
      description: "description",
      periodStart: "period_start",
      periodEnd: "period_end",
      retentionPercent: "retention_percent",
      advanceDeduction: "advance_deduction",
    };
    const sets: string[] = [];
    const args: any[] = [];
    for (const [k, vCol] of Object.entries(map)) {
      if (body[k] !== undefined) {
        sets.push(`${vCol} = ?`);
        args.push(
          ["retentionPercent", "advanceDeduction"].includes(k)
            ? Number(body[k])
            : body[k],
        );
      }
    }

    const newItems = Array.isArray(body.items) ? parseItems(body.items) : null;
    let totals: ReturnType<typeof computeCutTotals<CutItemInput>> | null = null;
    if (
      newItems ||
      body.retentionPercent !== undefined ||
      body.advanceDeduction !== undefined
    ) {
      const items =
        newItems ??
        (
          await query<any[]>(
            `SELECT quantity, unit_price FROM work_cut_items WHERE work_cut_id = ?`,
            [body.id],
          )
        ).map((r) => ({
          quantity: Number(r.quantity),
          unitPrice: Number(r.unit_price),
        }));
      totals = computeCutTotals(
        items,
        Number(body.retentionPercent ?? current[0].retention_percent ?? 0),
        Number(body.advanceDeduction ?? current[0].advance_deduction ?? 0),
      );
      sets.push("gross_value = ?", "retention_value = ?", "net_value = ?");
      args.push(totals.grossValue, totals.retentionValue, totals.netValue);
    }

    await transaction(async (conn) => {
      if (sets.length) {
        await conn.execute(
          `UPDATE work_cuts SET ${sets.join(", ")} WHERE id = ?`,
          [...args, body.id],
        );
      }
      // Reemplazar items si se proporcionan completos
      if (newItems && totals) {
        await conn.execute(`DELETE FROM work_cut_items WHERE work_cut_id = ?`, [
          body.id,
        ]);
        for (const it of totals.items) {
          await conn.execute(
            `INSERT INTO work_cut_items
             (id, work_cut_id, description, unit, quantity, unit_price, total_price, budget_item_code)
             VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
            [
              body.id,
              it.description,
              it.unit,
              it.quantity,
              it.unitPrice,
              it.totalPrice,
              it.budgetItemCode ?? null,
            ],
          );
        }
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[cuts PUT]", e?.code, e?.message);
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
    // Solo se pueden eliminar cortes en DRAFT o REJECTED
    const r = await query<any[]>(`SELECT status FROM work_cuts WHERE id = ?`, [
      id,
    ]);
    if (!r.length)
      return NextResponse.json({ error: "Corte no existe" }, { status: 404 });
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
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  // Quién actúa sale de la sesión; `body.user` se ignora.
  const { user } = auth as AuthSuccess;
  try {
    const body = await req.json();
    const { id, action, comments, rejectionReason } = body ?? {};
    if (!id || !action) {
      return NextResponse.json(
        { error: "id y action requeridos" },
        { status: 400 },
      );
    }

    // P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.1):
    //   Mismo patron que /api/payments PATCH: lectura con SELECT ... FOR
    //   UPDATE dentro de la transaccion para serializar aprobaciones
    //   concurrentes. Antes, validar -> aprobar -> validar -> aprobar
    //   podia duplicarse.
    const result = await transaction(async (conn) => {
      const [lockRows] = await conn.execute(
        `SELECT status, created_by FROM work_cuts WHERE id = ? FOR UPDATE`,
        [id],
      );
      const lockArr = lockRows as any[];
      if (!lockArr.length) {
        return { status: 404 as const, body: { error: "Corte no existe" } };
      }
      const currentStatus = lockArr[0].status;
      const currentCreatedBy = lockArr[0].created_by;

      // Reglas de rol, motivo de rechazo y transicion: lib/cuts-workflow.ts
      const decision = evaluateCutAction(currentStatus, action, user.role, {
        rejectionReason,
      });
      if (!decision.ok) {
        return {
          status: decision.status as number,
          body: { error: decision.error, code: decision.code },
        };
      }

      // P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.1):
      //   Segregacion de funciones: el creador del corte no puede
      //   validarlo, aprobarlo, rechazarlo ni pagarlo. ADMIN queda fuera
      //   del bloqueo por ser superusuario. SUBMIT es libre porque el
      //   residente es quien empuja su propio corte a revision.
      const isSelfClosing =
        action === "VALIDATE" ||
        action === "APPROVE" ||
        action === "REJECT" ||
        action === "PAY";
      if (
        isSelfClosing &&
        currentCreatedBy &&
        currentCreatedBy === user.id &&
        user.role !== "ADMIN"
      ) {
        return {
          status: 403 as const,
          body: {
            error:
              "No puedes validar, aprobar, rechazar ni pagar un corte que tu mismo creaste",
            code: "SELF_APPROVAL_FORBIDDEN",
          },
        };
      }
      const target = decision.target;
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
          action,
          now,
          action,
          now,
          action,
          now,
          action,
          now,
          id,
        ],
      );
      await conn.execute(
        `INSERT INTO work_cut_approvals
         (id, work_cut_id, action, user_id, user_name, user_role, comments)
         VALUES (UUID(), ?, ?, ?, ?, ?, ?)`,
        [id, action, user.id, user.name, user.role, comments ?? null],
      );

      // P0 plan 2026-10-02 (Fase 1.3): al aprobar un corte, pre-creamos
      // un movimiento contable en POR_PAGAR para que el panel refleje
      // el valor ejecutado. Cuando el pago asociado se liquide (Fase
      // 1.2 en /api/payments), closeExpenseFromPayment() lo pasa a
      // PAGADO y le asigna la cuenta.
      if (action === "APPROVE") {
        const [cutRows] = await conn.execute(
          `SELECT project_id, period, net_value, contract_id
             FROM work_cuts WHERE id = ?`,
          [id],
        );
        const cut = (cutRows as any[])[0] ?? {};
        const sync = await syncExpenseOnCutApprove(
          {
            userId: user.id,
            sourceType: "WORK_CUT",
            sourceId: id,
            date: now.slice(0, 10),
            projectId: cut.project_id ?? null,
            costCenter: cut.project_id ? "Obra" : "Administracion",
            responsible: user.name,
            concept: `Corte ${id.slice(0, 8)} ${cut.period ?? ""}`.trim(),
            detail: cut.contract_id ? `Contrato ${cut.contract_id}` : null,
            amount: Number(cut.net_value ?? 0),
          },
          conn,
        );
        if (sync.ok === false) {
          return { status: 400 as const, body: { error: sync.error, code: sync.code } };
        }
      }
      return { status: 200 as const, body: { ok: true } };
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e: any) {
    console.error("[cuts PATCH/action]", e?.code, e?.message);
    return NextResponse.json({ error: "Error en transición" }, { status: 500 });
  }
}
