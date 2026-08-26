/**
 * CRUD: /api/contracts
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    notes: row.notes ?? "",
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

export async function GET(req: Request) {
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

function nextContractNumber(): string {
  const y = new Date().getFullYear();
  return `CTR-${y}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.projectId || !body?.providerId || !body?.value || !body?.type ||
        !body?.startDate || !body?.endDate || !body?.scopeOfWork) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 },
      );
    }
    const id = require("crypto").randomUUID();
    const number = body.contractNumber ?? nextContractNumber();
    await query(
      `INSERT INTO contracts
       (id, contract_number, project_id, provider_id, type, value,
        start_date, end_date, status, scope_of_work, retention_percent,
        advance_percent, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, number, body.projectId, body.providerId, body.type,
        Number(body.value), body.startDate, body.endDate,
        body.status ?? "DRAFT", body.scopeOfWork,
        Number(body.retentionPercent ?? 0),
        Number(body.advancePercent ?? 0),
        body.notes ?? null,
        body.createdBy ?? null,
      ],
    );
    return NextResponse.json({ id, ...body, contractNumber: number }, { status: 201 });
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
    return NextResponse.json({ error: "Error al crear contrato" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
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
        args.push(["value", "retentionPercent", "advancePercent"].includes(k)
          ? Number(body[k]) : body[k]);
      }
    }
    if (!sets.length) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    args.push(body.id);
    await query(`UPDATE contracts SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[contracts PUT]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    await query("DELETE FROM contracts WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[contracts DELETE]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
