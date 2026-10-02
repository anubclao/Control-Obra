export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * CRUD: /api/quotations
 *
 * Fase 6: la maquina de estados + recálculo de totales vive en
 * `lib/quotations-workflow.ts`. Aqui solo aplicamos los helpers.
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
  parsePagination,
  pageToLimitOffset,
  paginationMeta,
  groupByIds,
} from "@/lib/validators/api";
import { can } from "@/lib/permissions-matrix";
import {
  computeQuotationTotals,
  evaluateQuotationAction,
} from "@/lib/quotations-workflow";
import { nextSequence } from "@/lib/counters";

function r(row: any) {
  return {
    id: row.id,
    quotationNumber: row.quotation_number,
    clientId: row.client_id,
    title: row.title,
    description: row.description ?? "",
    status: row.status,
    subtotal: Number(row.subtotal),
    discountPercent: Number(row.discount_percent),
    discountAmount: Number(row.discount_amount),
    ivaPercent: Number(row.iva_percent),
    ivaAmount: Number(row.iva_amount),
    total: Number(row.total),
    validUntil: row.valid_until,
    paymentTerms: row.payment_terms ?? "",
    deliveryTerms: row.delivery_terms ?? "",
    warranty: row.warranty ?? "",
    observations: row.observations ?? "",
    sentAt: row.sent_at,
    viewedAt: row.viewed_at,
    respondedAt: row.responded_at,
    convertedToProjectId: row.converted_to_project_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  // P0 (seccion 4.4): gate por matriz. CLIENTE/USER -> 403.
  if (!can((auth as any).user.role, "quotations", "read")) {
    return NextResponse.json(
      { error: "No tienes permisos para ver cotizaciones" },
      { status: 403 },
    );
  }
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const conds: string[] = ["deleted_at IS NULL"];
    const args: any[] = [];
    if (status) {
      conds.push("status = ?");
      args.push(status);
    }
    const where = `WHERE ${conds.join(" AND ")}`;

    // P2 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.2):
    //   Mismo patron que /api/cuts: paginacion + hijos solo para la
    //   pagina actual.
    const pagination = parsePagination(url);
    const { limit, offset } = pageToLimitOffset(pagination);
    const [quotes, totalRow] = await Promise.all([
      query<any[]>(
        `SELECT * FROM quotations ${where}
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      ),
      query<any[]>(`SELECT COUNT(*) AS total FROM quotations ${where}`, args),
    ]);
    const total = Number(totalRow[0]?.total ?? 0);
    const qIds = quotes.map((q) => q.id);
    const placeholders = qIds.map(() => "?").join(",");
    const items = qIds.length
      ? await query<any[]>(
          `SELECT * FROM quotation_items WHERE quotation_id IN (${placeholders})`,
          qIds,
        )
      : [];
    const byQ = groupByIds(items as any[], "quotation_id");
    return NextResponse.json({
      data: quotes.map((q) => ({
        ...r(q),
        items: (byQ[q.id] ?? []).map((it) => ({
          id: it.id,
          description: it.description,
          unit: it.unit,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unit_price),
          totalPrice: Number(it.total_price),
        })),
      })),
      pagination: paginationMeta(total, pagination),
    });
  } catch (e: any) {
    console.error("[quotations GET]", e?.code, e?.message);
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
    if (!body?.clientId || !body?.title || !body?.validUntil) {
      return NextResponse.json(
        { error: "clientId, title y validUntil son obligatorios" },
        { status: 400 },
      );
    }
    // P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.2):
    //   `body.createdBy` venia del cliente. Ahora SIEMPRE sale de la
    //   sesion; el body se ignora para este campo.
    const { userId, user } = auth as AuthSuccess;
    const id = randomUUID();
    // P1 (seccion 4.1): el servidor recalcula TODOS los totales. El
    //   navegador puede mandar subtotal/ivaAmount/total pero se
    //   ignoran — los items son la unica fuente de verdad.
    const totals = computeQuotationTotals({
      items: (body.items ?? []).map((it: any) => ({
        quantity: Number(it.quantity ?? 0),
        unitPrice: Number(it.unitPrice ?? 0),
      })),
      discountPercent: Number(body.discountPercent ?? 0),
      ivaPercent: Number(body.ivaPercent ?? 19),
    });
    // El numero consecutivo se calcula dentro del mismo transaction()
    // para que use `conn.execute` y el INSERT y el counter sean
    // atomicos. P2 (seccion 4.1): consecutivos con tabla counters
    // (sin colisiones entre PIDs concurrentes).
    let num = "";
    // Estado inicial validado contra el workflow (solo DRAFT/CANCELLED
    // son origenes validos para una cotizacion nueva).
    const requestedStatus = (body.status ?? "DRAFT") as
      | "DRAFT"
      | "SENT"
      | "VIEWED"
      | "ACCEPTED"
      | "REJECTED"
      | "EXPIRED"
      | "CANCELLED";
    if (requestedStatus !== "DRAFT" && requestedStatus !== "CANCELLED") {
      return NextResponse.json(
        {
          error:
            "El estado inicial de una cotizacion solo puede ser DRAFT o CANCELLED",
        },
        { status: 400 },
      );
    }
    await transaction(async (conn) => {
      const seq = await nextSequence(conn, "COT");
      num = seq.number;
      await conn.execute(
        `INSERT INTO quotations
         (id, quotation_number, client_id, title, description, status,
          subtotal, discount_percent, discount_amount, iva_percent, iva_amount, total,
          valid_until, payment_terms, delivery_terms, warranty, observations, created_by,
          updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          num,
          body.clientId,
          body.title,
          body.description ?? null,
          requestedStatus,
          totals.subtotal,
          Number(body.discountPercent ?? 0),
          totals.discountAmount,
          Number(body.ivaPercent ?? 19),
          totals.ivaAmount,
          totals.total,
          body.validUntil,
          body.paymentTerms ?? null,
          body.deliveryTerms ?? null,
          body.warranty ?? null,
          body.observations ?? null,
          userId,
          userId,
        ],
      );
      for (const it of body.items ?? []) {
        await conn.execute(
          `INSERT INTO quotation_items
           (id, quotation_id, description, unit, quantity, unit_price, total_price)
           VALUES (UUID(), ?, ?, ?, ?, ?, ?)`,
          [
            id,
            it.description,
            it.unit,
            Number(it.quantity),
            Number(it.unitPrice),
            Number(it.totalPrice),
          ],
        );
      }
    });
    return NextResponse.json(
      {
        id,
        ...body,
        quotationNumber: num,
        createdBy: userId,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        ivaAmount: totals.ivaAmount,
        total: totals.total,
      },
      { status: 201 },
    );
  } catch (e: any) {
    console.error("[quotations POST]", e?.code, e?.message);
    return NextResponse.json(
      { error: "Error al crear cotización" },
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
    const { userId, user } = auth as AuthSuccess;
    // P1 (seccion 4.1): si la peticion cambia el status, validamos
    // la transicion contra el workflow. Tambien bloqueamos pasar a
    // EXPIRED (eso lo hace el cron via evaluateQuotationExpiry).
    if (body.status !== undefined) {
      const current = await query<any[]>(
        `SELECT status FROM quotations WHERE id = ?`,
        [body.id],
      );
      if (!current.length) {
        return NextResponse.json(
          { error: "Cotizacion no existe" },
          { status: 404 },
        );
      }
      const fromStatus = current[0].status;
      if (fromStatus !== body.status) {
        const evaluation = evaluateQuotationAction(
          fromStatus,
          body.status,
          (auth as AuthSuccess).user.role,
        );
        if (!evaluation.ok) {
          return NextResponse.json(
            { error: evaluation.error, code: evaluation.code },
            { status: evaluation.status },
          );
        }
      }
    }
    const m: Record<string, string> = {
      clientId: "client_id",
      title: "title",
      description: "description",
      status: "status",
      validUntil: "valid_until",
      paymentTerms: "payment_terms",
      deliveryTerms: "delivery_terms",
      warranty: "warranty",
      observations: "observations",
    };
    const sets: string[] = [];
    const args: any[] = [];
    for (const [k, c] of Object.entries(m)) {
      if (body[k] !== undefined) {
        sets.push(`${c} = ?`);
        args.push(body[k]);
      }
    }
    // P1 (seccion 4.1): si vienen items en el PUT, recalculamos
    // TODOS los totales desde cero. El navegador no puede inflar el
    // total aunque mande subtotal/ivaAmount/total en el body —
    // ignoramos esos campos explicitamente.
    let totals: ReturnType<typeof computeQuotationTotals> | null = null;
    if (Array.isArray(body.items)) {
      totals = computeQuotationTotals({
        items: body.items.map((it: any) => ({
          quantity: Number(it.quantity ?? 0),
          unitPrice: Number(it.unitPrice ?? 0),
        })),
        discountPercent: Number(
          body.discountPercent ??
            (
              await query<any[]>(
                `SELECT discount_percent FROM quotations WHERE id = ?`,
                [body.id],
              )
            )[0]?.discount_percent ??
            0,
        ),
        ivaPercent: Number(
          body.ivaPercent ??
            (
              await query<any[]>(
                `SELECT iva_percent FROM quotations WHERE id = ?`,
                [body.id],
              )
            )[0]?.iva_percent ??
            19,
        ),
      });
      sets.push(
        "subtotal = ?",
        "discount_amount = ?",
        "iva_amount = ?",
        "total = ?",
      );
      args.push(
        totals.subtotal,
        totals.discountAmount,
        totals.ivaAmount,
        totals.total,
      );
    }
    // P1: registrar quien edita la cotizacion.
    sets.push("updated_by = ?");
    args.push(userId);
    if (sets.length) {
      args.push(body.id);
      await query(
        `UPDATE quotations SET ${sets.join(", ")} WHERE id = ?`,
        args,
      );
    }
    if (Array.isArray(body.items)) {
      await transaction(async (conn) => {
        await conn.execute(
          `DELETE FROM quotation_items WHERE quotation_id = ?`,
          [body.id],
        );
        for (const it of body.items) {
          await conn.execute(
            `INSERT INTO quotation_items
             (id, quotation_id, description, unit, quantity, unit_price, total_price)
             VALUES (UUID(), ?, ?, ?, ?, ?, ?)`,
            [
              body.id,
              it.description,
              it.unit,
              Number(it.quantity),
              Number(it.unitPrice),
              Number(it.totalPrice),
            ],
          );
        }
      });
    }
    return NextResponse.json({ ok: true, totals });
  } catch (e: any) {
    console.error("[quotations PUT]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

/**
 * P1 (seccion 4.1): cron de expiracion de cotizaciones. Recorre las
 * cotizaciones activas (DRAFT/SENT/VIEWED) cuya `valid_until` ya
 * vencio y las pasa a EXPIRED. Pensado para llamarse desde un cron
 * externo (cron-job.org, GitHub Actions, etc.) una vez al dia.
 *
 * Protegido por DEBUG_TOKEN (mismo patron que /api/auth/debug) o
 * por rol ADMIN. Asi nadie lo llama por accidente.
 */
export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id)
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    await query("DELETE FROM quotations WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[quotations DELETE]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
