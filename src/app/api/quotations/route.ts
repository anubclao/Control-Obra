export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * CRUD: /api/quotations
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
    const { userId } = auth as AuthSuccess;
    const id = randomUUID();
    const num = `COT-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    await transaction(async (conn) => {
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
          body.status ?? "DRAFT",
          Number(body.subtotal ?? 0),
          Number(body.discountPercent ?? 0),
          Number(body.discountAmount ?? 0),
          Number(body.ivaPercent ?? 0),
          Number(body.ivaAmount ?? 0),
          Number(body.total ?? 0),
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
      { id, ...body, quotationNumber: num, createdBy: userId },
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
    const { userId } = auth as AuthSuccess;
    const m: Record<string, string> = {
      clientId: "client_id",
      title: "title",
      description: "description",
      status: "status",
      subtotal: "subtotal",
      discountPercent: "discount_percent",
      discountAmount: "discount_amount",
      ivaPercent: "iva_percent",
      ivaAmount: "iva_amount",
      total: "total",
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
        args.push(
          [
            "subtotal",
            "discountPercent",
            "discountAmount",
            "ivaPercent",
            "ivaAmount",
            "total",
          ].includes(k)
            ? Number(body[k])
            : body[k],
        );
      }
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
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[quotations PUT]", e?.code, e?.message);
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
    await query("DELETE FROM quotations WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[quotations DELETE]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
