export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * CRUD: /api/clients
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
import { can } from "@/lib/permissions-matrix";
import { evaluateClientStage } from "@/lib/clients-workflow";

function r(row: any) {
  return {
    id: row.id,
    clientNumber: row.client_number,
    companyName: row.company_name,
    nit: row.nit ?? "",
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    city: row.city,
    sector: row.sector ?? "",
    source: row.source,
    status: row.status,
    notes: row.notes ?? "",
    // P1: campos de auditoria nuevos (migracion 011). Se exponen
    // para que la UI pueda mostrar responsable comercial y quien
    // dio de alta al cliente.
    createdBy: row.created_by ?? null,
    ownerId: row.owner_id ?? null,
    createdAt: row.created_at,
  };
}

export async function GET() {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  // P0 (seccion 4.4): antes cualquier usuario autenticado veia todos
  // los clientes. Ahora la matriz decide. CLIENTE/USER -> 403.
  const { can } = await import("@/lib/permissions-matrix");
  if (!can((auth as any).user.role, "clients", "read")) {
    return NextResponse.json(
      { error: "No tienes permisos para ver clientes" },
      { status: 403 },
    );
  }
  try {
    // P1 (migracion 011): excluir clientes archivados por defecto.
    const rows = await query<any[]>(
      `SELECT * FROM clients WHERE deleted_at IS NULL ORDER BY company_name ASC`,
    );
    return NextResponse.json(rows.map(r));
  } catch (e: any) {
    console.error("[clients GET]", e?.code, e?.message);
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
      !body?.companyName ||
      !body?.contactName ||
      !body?.email ||
      !body?.phone ||
      !body?.city ||
      !body?.source
    ) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 },
      );
    }
    // P1: created_by desde la sesion; owner_id por defecto es el mismo
    // usuario. La UI podra reasignarlo mas adelante.
    const { userId } = auth as AuthSuccess;
    const id = randomUUID();
    const num = `CLI-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    await query(
      `INSERT INTO clients
       (id, client_number, company_name, nit, contact_name, email, phone, city,
        sector, source, status, notes, created_by, owner_id, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        num,
        body.companyName,
        body.nit ?? null,
        body.contactName,
        body.email,
        body.phone,
        body.city,
        body.sector ?? null,
        body.source,
        body.status ?? "PROSPECT",
        body.notes ?? null,
        userId,
        userId,
        userId,
      ],
    );
    return NextResponse.json(
      { id, ...body, clientNumber: num, createdBy: userId, ownerId: userId },
      { status: 201 },
    );
  } catch (e: any) {
    console.error("[clients POST]", e?.code, e?.message);
    return NextResponse.json(
      { error: "Error al crear cliente" },
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
    const m: Record<string, string> = {
      companyName: "company_name",
      nit: "nit",
      contactName: "contact_name",
      email: "email",
      phone: "phone",
      city: "city",
      sector: "sector",
      source: "source",
      status: "status",
      notes: "notes",
    };
    const sets: string[] = [];
    const args: any[] = [];
    for (const [k, c] of Object.entries(m)) {
      if (body[k] !== undefined) {
        sets.push(`${c} = ?`);
        args.push(body[k]);
      }
    }
    if (!sets.length)
      return NextResponse.json(
        { error: "Nada que actualizar" },
        { status: 400 },
      );

    // P1 (seccion 4.1): si la peticion cambia status, validamos la
    // transicion contra `clients-workflow.ts` y dejamos un registro
    // en `client_stage_history` (migracion 013). Todo en una sola
    // transaccion para evitar inconsistencia si la insercion falla.
    let stageValidation: {
      from: string;
      to: string;
      reason: string | null;
    } | null = null;
    if (body.status !== undefined) {
      const current = await query<any[]>(
        `SELECT status FROM clients WHERE id = ?`,
        [body.id],
      );
      if (!current.length) {
        return NextResponse.json(
          { error: "Cliente no existe" },
          { status: 404 },
        );
      }
      const fromStatus = current[0].status;
      if (fromStatus !== body.status) {
        const evaluation = evaluateClientStage(
          fromStatus,
          body.status,
          (auth as AuthSuccess).user.role,
          { reason: body.stageReason ?? null },
        );
        if (!evaluation.ok) {
          return NextResponse.json(
            { error: evaluation.error, code: evaluation.code },
            { status: evaluation.status },
          );
        }
        stageValidation = {
          from: fromStatus,
          to: body.status,
          reason: body.stageReason ?? null,
        };
      }
    }

    // P1 (migracion 011): siempre actualizar updated_by al editar.
    sets.push("updated_by = ?");
    args.push((auth as AuthSuccess).userId);
    args.push(body.id);

    await transaction(async (conn) => {
      await conn.execute(
        `UPDATE clients SET ${sets.join(", ")} WHERE id = ?`,
        args,
      );
      if (stageValidation) {
        await conn.execute(
          `INSERT INTO client_stage_history
             (id, client_id, from_status, to_status, reason, changed_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            randomUUID(),
            body.id,
            stageValidation.from,
            stageValidation.to,
            stageValidation.reason,
            (auth as AuthSuccess).userId,
          ],
        );
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[clients PUT]", e?.code, e?.message);
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
    // P1 (migracion 011): soft delete con deleted_by para conservar
    // la auditoria comercial (no se pierde la trazabilidad del
    // prospecto que se dio de baja).
    await query(
      `UPDATE clients SET deleted_at = NOW(), deleted_by = ? WHERE id = ?`,
      [(auth as AuthSuccess).userId, id],
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[clients DELETE]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
