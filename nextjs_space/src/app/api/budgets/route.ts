export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * CRUD: /api/budgets — Presupuestos Tope
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth, requireRole, requireAdmin, authFailureResponse } from "@/lib/api-auth";


function r(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    activeVersionId: row.active_version_id,
    totalValue: Number(row.total_value),
    clientValue: Number(row.client_value),
    unforeseenValue: Number(row.unforeseen_value),
    createdAt: row.created_at,
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
      `SELECT * FROM budgets ${where} ORDER BY created_at DESC`, args,
    );
    return NextResponse.json(rows.map(r));
  } catch (e: any) {
    console.error("[budgets GET]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN","GERENTE","DIRECTOR","RESIDENTE","CONTABILIDAD","TESORERIA","HSEQ");
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.projectId) return NextResponse.json({ error: "projectId requerido" }, { status: 400 });
    const id = require("crypto").randomUUID();
    await query(
      `INSERT INTO budgets (id, project_id, total_value, client_value, unforeseen_value)
       VALUES (?, ?, ?, ?, ?)`,
      [id, body.projectId,
       Number(body.totalValue ?? 0), Number(body.clientValue ?? 0),
       Number(body.unforeseenValue ?? 0)],
    );
    return NextResponse.json({ id, ...body }, { status: 201 });
  } catch (e: any) {
    console.error("[budgets POST]", e?.code, e?.message);
    if (e?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "El proyecto ya tiene presupuesto" }, { status: 409 });
    }
    return NextResponse.json({ error: "Error al crear presupuesto" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireRole("ADMIN","GERENTE","DIRECTOR","RESIDENTE","CONTABILIDAD","TESORERIA","HSEQ");
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const sets: string[] = []; const args: any[] = [];
    for (const [k, c] of Object.entries({
      activeVersionId: "active_version_id",
      totalValue: "total_value", clientValue: "client_value",
      unforeseenValue: "unforeseen_value",
    })) {
      if (body[k] !== undefined) {
        sets.push(`${c} = ?`);
        args.push(k === "activeVersionId" ? body[k] : Number(body[k]));
      }
    }
    if (!sets.length) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    args.push(body.id);
    await query(`UPDATE budgets SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[budgets PUT]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}
