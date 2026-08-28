/**
 * CRUD: /api/projects
 *
 * Auth:
 *   GET    → cualquiera con sesión válida
 *   POST   → requireRole("ADMIN","GERENTE","DIRECTOR","RESIDENTE")
 *   PUT    → requireRole(idem)
 *   DELETE → requireAdmin (Super Admin)
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth, requireRole, requireAdmin, authFailureResponse } from "@/lib/api-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mapear snake_case de BD → camelCase para el frontend
function rowToDTO(r: any) {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    client: r.client,
    location: r.location,
    startDate: r.start_date,
    estimatedEndDate: r.estimated_end_date,
    totalBudget: Number(r.total_budget ?? 0),
    executedAmount: Number(r.executed_amount ?? 0),
    status: r.status,
    description: r.description ?? "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const where = status ? "WHERE status = ?" : "";
    const args = status ? [status] : [];
    const rows = await query<any[]>(
      `SELECT * FROM projects ${where} ORDER BY created_at DESC`,
      args,
    );
    return NextResponse.json(rows.map(rowToDTO));
  } catch (e: any) {
    console.error("[projects GET]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(
    "ADMIN",
    "GERENTE",
    "DIRECTOR",
    "RESIDENTE",
  );
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.name || !body?.code || !body?.client || !body?.location ||
        !body?.startDate || !body?.estimatedEndDate) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 },
      );
    }
    const id = require("crypto").randomUUID();
    await query(
      `INSERT INTO projects
        (id, code, name, client, location, start_date, estimated_end_date,
         total_budget, executed_amount, status, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.code,
        body.name,
        body.client,
        body.location,
        body.startDate,
        body.estimatedEndDate,
        Number(body.totalBudget ?? 0),
        Number(body.executedAmount ?? 0),
        body.status ?? "IN_PLANNING",
        body.description ?? null,
      ],
    );
    return NextResponse.json({ id, ...body }, { status: 201 });
  } catch (e: any) {
    console.error("[projects POST]", e?.code, e?.message);
    if (e?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "Ya existe un proyecto con ese código" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Error al crear proyecto" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireRole(
    "ADMIN",
    "GERENTE",
    "DIRECTOR",
    "RESIDENTE",
  );
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }
    const sets: string[] = [];
    const args: any[] = [];
    const map: Record<string, string> = {
      name: "name",
      client: "client",
      location: "location",
      startDate: "start_date",
      estimatedEndDate: "estimated_end_date",
      totalBudget: "total_budget",
      executedAmount: "executed_amount",
      status: "status",
      description: "description",
    };
    for (const [k, vCol] of Object.entries(map)) {
      if (body[k] !== undefined) {
        sets.push(`${vCol} = ?`);
        args.push(k === "totalBudget" || k === "executedAmount" ? Number(body[k]) : body[k]);
      }
    }
    if (sets.length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }
    args.push(body.id);
    await query(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[projects PUT]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }
    await query("DELETE FROM projects WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[projects DELETE]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
