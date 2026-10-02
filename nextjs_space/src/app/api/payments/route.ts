export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * CRUD: /api/payments — solicitudes de pago con multinivel
 */
import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { randomUUID } from "node:crypto";
import { nextSequence } from "@/lib/counters";
import {
  requireAuth,
  requireRole,
  requireAdmin,
  authFailureResponse,
  type AuthSuccess,
} from "@/lib/api-auth";
import {
  evaluatePaymentAction,
  isValidApprovalLevel,
  isPaymentEditable,
} from "@/lib/payments-workflow";
import { accountNumberForRole } from "@/lib/account-mask";
import { paymentAmountSchema } from "@/lib/validators/numeric";
import { can } from "@/lib/permissions-matrix";
import { syncExpenseOnPayment, closeExpenseFromPayment } from "@/lib/accounting-integration";

function dto(r: any, viewerRole: string) {
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
    // P0 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.4):
    //   El numero de cuenta se enmascara para roles no internos. Los
    //   roles internos (ADMIN/GERENTE/DIRECTOR/TESORERIA/CONTABILIDAD)
    //   siguen viendo el numero completo para poder operar pagos.
    accountNumber: accountNumberForRole(r.account_number, viewerRole),
    dueDate: r.due_date ?? undefined,
    description: r.description ?? "",
    paidAt: r.paid_at,
    paidReference: r.paid_reference ?? "",
    paidMethod: r.paid_method,
    rejectionReason: r.rejection_reason ?? "",
    // P2 plan 2026-10-01 (fase 6.3): cuando esta solicitud fue creada
    // para corregir y reenviar una REJECTED, aqui viene el id del
    // padre. Sirve para que la UI pueda mostrar "Reemplaza a PAG-..."
    // y enlazar al historial.
    replacesRequestId: r.replaces_request_id ?? undefined,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  // P0 (seccion 4.4): gate por matriz. CLIENTE/USER -> 403.
  if (!can((auth as any).user.role, "payments", "read")) {
    return NextResponse.json(
      { error: "No tienes permisos para ver solicitudes de pago" },
      { status: 403 },
    );
  }
  // P0 (seccion 4.4): gate por matriz. CLIENTE/USER -> 403.
  if (!can((auth as any).user.role, "payments", "read")) {
    return NextResponse.json(
      { error: "No tienes permisos para ver solicitudes de pago" },
      { status: 403 },
    );
  }
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const status = url.searchParams.get("status");
    const conds: string[] = [];
    const args: any[] = [];
    if (projectId) {
      conds.push("project_id = ?");
      args.push(projectId);
    }
    if (status) {
      conds.push("status = ?");
      args.push(status);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const rows = await query<any[]>(
      `SELECT * FROM payment_requests ${where} ORDER BY created_at DESC`,
      args,
    );
    // P0: el DTO recibe el rol del viewer para enmascarar account_number.
    const viewerRole = (auth as AuthSuccess).user.role;
    return NextResponse.json(rows.map((r) => dto(r, viewerRole)));
  } catch (e: any) {
    console.error("[payments GET]", e?.code, e?.message);
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
      !body?.amount ||
      !body?.type ||
      !body?.beneficiaryName ||
      !body?.beneficiaryNit
    ) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 },
      );
    }
    const requiredApprovalLevel = Number(body.requiredApprovalLevel ?? 1);
    if (!isValidApprovalLevel(requiredApprovalLevel)) {
      return NextResponse.json(
        {
          error: "requiredApprovalLevel debe ser 1 o 2",
          code: "INVALID_APPROVAL_LEVEL",
        },
        { status: 400 },
      );
    }

    // P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.1):
    //   Antes `!body.amount` solo rechazaba 0 o vacio, dejando pasar
    //   numeros negativos. Validamos con Zod que sea un numero finito > 0.
    const amountValidation = paymentAmountSchema.safeParse({
      amount: Number(body.amount),
    });
    if (!amountValidation.success) {
      return NextResponse.json(
        {
          error: amountValidation.error.issues[0]?.message ?? "Monto invalido",
          code: "INVALID_AMOUNT",
        },
        { status: 400 },
      );
    }

    // P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.1):
    //   Si la solicitud viene con workCutId, el servidor valida tres
    //   cosas que antes solo hacia la UI: (1) el corte debe estar en
    //   APPROVED, (2) no debe haber otra solicitud activa para el mismo
    //   corte, (3) el monto no puede superar el neto del corte.
    if (body.workCutId) {
      const [cutRows, openRows] = await Promise.all([
        query<any[]>(`SELECT status, net_value FROM work_cuts WHERE id = ?`, [
          body.workCutId,
        ]),
        query<any[]>(
          `SELECT id, amount FROM payment_requests
            WHERE work_cut_id = ?
              AND status IN ('PENDING','APPROVED_LEVEL_1','APPROVED_LEVEL_2','APPROVED')`,
          [body.workCutId],
        ),
      ]);
      if (!cutRows.length) {
        return NextResponse.json(
          { error: "El corte asociado no existe" },
          { status: 400 },
        );
      }
      if (cutRows[0].status !== "APPROVED") {
        return NextResponse.json(
          {
            error: `El corte asociado debe estar en APPROVED (esta en ${cutRows[0].status})`,
            code: "CUT_NOT_APPROVED",
          },
          { status: 400 },
        );
      }
      if (openRows.length > 0) {
        return NextResponse.json(
          {
            error: "Ya existe una solicitud activa para este corte",
            code: "CUT_ALREADY_HAS_OPEN_PAYMENT",
          },
          { status: 409 },
        );
      }
      const netValue = Number(cutRows[0].net_value ?? 0);
      if (Number(body.amount) > netValue) {
        return NextResponse.json(
          {
            error: `El monto (${body.amount}) supera el neto del corte (${netValue})`,
            code: "AMOUNT_EXCEEDS_NET_VALUE",
          },
          { status: 400 },
        );
      }
    }
    const id = randomUUID();

    // P2 plan 2026-10-01 (fase 6.3): si el cliente manda
    // `replacesRequestId`, validamos que la solicitud original este
    // en status = REJECTED. Sin esto, podria referenciarse un id
    // cualquiera y enlazar solicitudes sin sentido.
    let replacesRequestId: string | null = null;
    if (body.replacesRequestId) {
      const parentRows = (await query<any[]>(
        `SELECT id, status FROM payment_requests WHERE id = ?`,
        [body.replacesRequestId],
      )) as any[];
      if (!parentRows.length) {
        return NextResponse.json(
          { error: "La solicitud original no existe" },
          { status: 400 },
        );
      }
      if (parentRows[0].status !== "REJECTED") {
        return NextResponse.json(
          {
            error: `Solo se puede reemplazar una solicitud REJECTED (la original esta en ${parentRows[0].status})`,
            code: "PARENT_NOT_REJECTED",
          },
          { status: 409 },
        );
      }
      replacesRequestId = body.replacesRequestId;
    }

    // P2 plan 2026-10-01 (fase 6.1): consecutivos en tabla counters
    // en vez de Date.now(). Lo calculamos dentro del transaction() para
    // que la asignacion del numero y el INSERT sean atomicos.
    let num = "";
    await transaction(async (conn) => {
      const seq = await nextSequence(conn, "PAG");
      num = seq.number;
      await conn.execute(
        `INSERT INTO payment_requests
         (id, request_number, project_id, provider_id, work_cut_id,
          replaces_request_id, type, amount, priority, status,
          current_approval_level, required_approval_level,
          beneficiary_name, beneficiary_nit, bank_name, account_type, account_number,
          due_date, description, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          num,
          body.projectId,
          body.providerId ?? null,
          body.workCutId ?? null,
          replacesRequestId,
          body.type,
          Number(body.amount),
          body.priority ?? "NORMAL",
          requiredApprovalLevel,
          body.beneficiaryName,
          body.beneficiaryNit,
          body.bankName,
          body.accountType ?? "CHECKING",
          body.accountNumber,
          body.dueDate ?? null,
          body.description ?? null,
          (auth as AuthSuccess).userId,
        ],
      );
    });
    return NextResponse.json(
      {
        id,
        ...body,
        requestNumber: num,
        replacesRequestId: replacesRequestId ?? undefined,
      },
      { status: 201 },
    );
  } catch (e: any) {
    console.error("[payments POST]", e?.code, e?.message);
    return NextResponse.json(
      { error: "Error al crear solicitud" },
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
      `SELECT status FROM payment_requests WHERE id = ?`,
      [body.id],
    );
    if (!current.length)
      return NextResponse.json(
        { error: "Solicitud no existe" },
        { status: 404 },
      );
    if (!isPaymentEditable(current[0].status)) {
      return NextResponse.json(
        {
          error: "Solo se pueden editar solicitudes pendientes",
          code: "PAYMENT_NOT_EDITABLE",
        },
        { status: 409 },
      );
    }
    if (
      body.requiredApprovalLevel !== undefined &&
      !isValidApprovalLevel(Number(body.requiredApprovalLevel))
    ) {
      return NextResponse.json(
        {
          error: "requiredApprovalLevel debe ser 1 o 2",
          code: "INVALID_APPROVAL_LEVEL",
        },
        { status: 400 },
      );
    }
    const map: Record<string, string> = {
      projectId: "project_id",
      providerId: "provider_id",
      workCutId: "work_cut_id",
      type: "type",
      amount: "amount",
      priority: "priority",
      beneficiaryName: "beneficiary_name",
      beneficiaryNit: "beneficiary_nit",
      bankName: "bank_name",
      accountType: "account_type",
      accountNumber: "account_number",
      dueDate: "due_date",
      description: "description",
      requiredApprovalLevel: "required_approval_level",
    };
    const sets: string[] = [];
    const args: any[] = [];
    for (const [k, vCol] of Object.entries(map)) {
      if (body[k] !== undefined) {
        sets.push(`${vCol} = ?`);
        args.push(k === "amount" ? Number(body[k]) : body[k]);
      }
    }
    if (!sets.length)
      return NextResponse.json(
        { error: "Nada que actualizar" },
        { status: 400 },
      );
    args.push(body.id);
    await query(
      `UPDATE payment_requests SET ${sets.join(", ")} WHERE id = ?`,
      args,
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[payments PUT]", e?.code, e?.message);
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
    const r = await query<any[]>(
      `SELECT status FROM payment_requests WHERE id = ?`,
      [id],
    );
    if (!r.length)
      return NextResponse.json(
        { error: "Solicitud no existe" },
        { status: 404 },
      );
    if (!["PENDING", "CANCELLED", "REJECTED"].includes(r[0].status)) {
      return NextResponse.json(
        {
          error:
            "Solo se eliminan solicitudes en PENDING, CANCELLED o REJECTED",
        },
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
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  // Quién actúa sale de la sesión; `body.user` se ignora.
  const { user } = auth as AuthSuccess;
  try {
    const body = await req.json();
    const {
      id,
      action,
      comments,
      rejectionReason,
      paymentReference,
      paymentMethod,
      // P0 plan 2026-10-02 (Fase 1.2): cuenta contable donde se paga.
      // Requerida para accion PAY. La UI la pide en el form de Tesorerol.
      accountId,
    } = body ?? {};
    if (!id || !action) {
      return NextResponse.json(
        { error: "id y action requeridos" },
        { status: 400 },
      );
    }

    // P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.1):
    //   Antes se leia el status fuera de la transaccion, se evaluaba la
    //   accion y recien ahi se abria la transaccion. Dos aprobadores
    //   simultaneos podian leer el mismo status y pasar ambos la
    //   validacion, dejando la transicion aplicada dos veces. Ahora la
    //   lectura es SELECT ... FOR UPDATE dentro de la misma transaccion,
    //   que toma un lock de fila hasta el COMMIT y serializa a los
    //   aprobadores.
    const result = await transaction(async (conn) => {
      const [lockRows] = await conn.execute(
        `SELECT status, required_approval_level, current_approval_level,
                work_cut_id, created_by
           FROM payment_requests WHERE id = ? FOR UPDATE`,
        [id],
      );
      const lockArr = lockRows as any[];
      if (!lockArr.length) {
        return { status: 404 as const, body: { error: "Solicitud no existe" } };
      }
      const current = lockArr[0];

      // Reglas de rol, nivel de aprobacion y transicion: lib/payments-workflow.ts
      const decision = evaluatePaymentAction(
        {
          status: current.status,
          requiredApprovalLevel: Number(current.required_approval_level ?? 1),
          currentApprovalLevel: Number(current.current_approval_level ?? 0),
        },
        action,
        user.role,
        { rejectionReason },
      );
      if (!decision.ok) {
        return {
          status: decision.status as number,
          body: { error: decision.error, code: decision.code },
        };
      }

      // P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.1):
      //   Segregacion de funciones: el creador de la solicitud no puede
      //   aprobarla ni pagarla. ADMIN queda fuera del bloqueo (es
      //   superusuario y ya podia pasar la validacion de rol). Lo mismo
      //   se aplica a REJECT y CANCEL, por consistencia: si no firmaste
      //   la creacion, no la cierras.
      const isSelfApproval =
        action === "APPROVE_L1" ||
        action === "APPROVE_L2" ||
        action === "PAY" ||
        action === "REJECT" ||
        action === "CANCEL";
      if (
        isSelfApproval &&
        current.created_by &&
        current.created_by === user.id &&
        user.role !== "ADMIN"
      ) {
        return {
          status: 403 as const,
          body: {
            error:
              "No puedes aprobar, pagar, rechazar ni cancelar una solicitud que tu mismo creaste",
            code: "SELF_APPROVAL_FORBIDDEN",
          },
        };
      }

      // P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.1):
      //   Tesoreria es la que registra el pago, por lo que la accion PAY
      //   debe llegar con referencia y metodo. Sin esto el servidor
      //   aceptaba pagar la solicitud "en blanco".
      if (action === "PAY") {
        if (
          !paymentReference ||
          typeof paymentReference !== "string" ||
          !paymentReference.trim()
        ) {
          return {
            status: 400 as const,
            body: {
              error: "La referencia de pago es obligatoria",
              code: "PAYMENT_REFERENCE_REQUIRED",
            },
          };
        }
        if (
          paymentMethod !== "TRANSFER" &&
          paymentMethod !== "CHECK" &&
          paymentMethod !== "CASH"
        ) {
          return {
            status: 400 as const,
            body: {
              error:
                "Metodo de pago invalido (debe ser TRANSFER, CHECK o CASH)",
              code: "INVALID_PAYMENT_METHOD",
            },
          };
        }
        // P0 plan 2026-10-02 (Fase 1.2): accountId es requerido para
        // poder generar el asiento contable (accounting_expenses) en la
        // misma transaccion. Sin cuenta, no sabemos donde sale el dinero.
        if (
          !accountId ||
          typeof accountId !== "string" ||
          !accountId.trim()
        ) {
          return {
            status: 400 as const,
            body: {
              error:
                "Indica la cuenta contable donde se realizo el pago",
              code: "PAYMENT_ACCOUNT_REQUIRED",
            },
          };
        }
      }
      const target = decision.target;
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      await conn.execute(
        `UPDATE payment_requests SET
          status = ?,
          paid_at = CASE WHEN ? = 'PAY' THEN ? ELSE paid_at END,
          paid_reference = CASE WHEN ? = 'PAY' THEN ? ELSE paid_reference END,
          paid_method = CASE WHEN ? = 'PAY' THEN ? ELSE paid_method END,
          account_id = CASE WHEN ? = 'PAY' THEN ? ELSE account_id END,
          current_approval_level = ?,
          rejection_reason = CASE WHEN ? = 'REJECT' THEN ? ELSE rejection_reason END
         WHERE id = ?`,
        [
          target,
          action,
          now,
          action,
          paymentReference ?? null,
          action,
          paymentMethod ?? null,
          action,
          accountId ?? null,
          decision.nextApprovalLevel,
          action,
          rejectionReason ?? null,
          id,
        ],
      );

      // P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.1):
      //   Si la solicitud esta ligada a un corte, al pagar la solicitud
      //   pasamos el corte a PAID en la misma transaccion. Asi el corte
      //   no tiene su propia accion PAY independiente y se evita la
      //   desincronizacion entre work_cuts.status y
      //   payment_requests.status.
      if (action === "PAY" && current.work_cut_id) {
        await conn.execute(
          `UPDATE work_cuts
              SET status = 'PAID',
                  paid_at = ?
            WHERE id = ? AND status = 'APPROVED'`,
          [now, current.work_cut_id],
        );
      }

      // P0 plan 2026-10-02 (Fase 1.2): al pagar una solicitud, generamos
      // automaticamente el movimiento contable (accounting_expenses PAGADO)
      // en la misma transaccion SQL. Asi el modulo /api/accounting/ deja
      // de estar desarticulado del modulo de pagos: el panel contable
      // refleja la operacion real.
      //
      // El helper valida accountId (activo) y projectId (no eliminado)
      // y es NO-OP si ya existe un expense para este source. Si falla la
      // validacion, devuelve 400 con codigo legible (no 500).
      if (action === "PAY") {
        const [payInfoRows] = await conn.execute(
          `SELECT p.project_id, p.amount, p.request_number, p.description,
                  p.work_cut_id
             FROM payment_requests p WHERE p.id = ?`,
          [id],
        );
        const payInfo = (payInfoRows as any[])[0] ?? {};
        const sync = await syncExpenseOnPayment(
          {
            userId: user.id,
            sourceType: "PAYMENT_REQUEST",
            sourceId: id,
            date: now.slice(0, 10),
            projectId: payInfo.project_id ?? null,
            costCenter: payInfo.project_id ? "Obra" : "Administracion",
            responsible: user.name,
            concept: `Pago ${payInfo.request_number ?? id}`,
            detail: payInfo.description ?? null,
            amount: Number(payInfo.amount ?? 0),
            accountId: accountId as string,
          },
          conn,
        );
        if (sync.ok === false) {
          return { status: 400 as const, body: { error: sync.error, code: sync.code } };
        }
        // Si el pago viene de un corte aprobado (Fase 1.3), el corte
        // ya tiene un accounting_expense en POR_PAGAR. Lo cerramos a
        // PAGADO con la misma cuenta.
        if (payInfo.work_cut_id) {
          await closeExpenseFromPayment(
            "WORK_CUT",
            payInfo.work_cut_id,
            accountId as string,
            conn,
          );
        }
      }

      await conn.execute(
        `INSERT INTO payment_approvals
         (id, payment_id, action, level, user_id, user_name, user_role, comments,
          payment_reference, payment_method)
         VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          action,
          decision.approvalLevel,
          user.id,
          user.name,
          user.role,
          comments ?? null,
          paymentReference ?? null,
          paymentMethod ?? null,
        ],
      );
      return { status: 200 as const, body: { ok: true } };
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e: any) {
    console.error("[payments PATCH/action]", e?.code, e?.message);
    return NextResponse.json({ error: "Error en acción" }, { status: 500 });
  }
}
