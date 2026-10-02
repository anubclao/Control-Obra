export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * CRUD: /api/aiu-configs — AIU por proyecto
 * A, I y U son % sobre costo directo; se validan con validateAiu.
 * Spec: docs/specs/bug-aiu-porcentaje-sobre-costo-directo.md
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth, requireRole, requireAdmin, authFailureResponse, type AuthSuccess } from "@/lib/api-auth";
import { validateAiu } from "@/lib/aiu-constants";


function r(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    administration: Number(row.administration),
    imprevistos: Number(row.imprevistos),
    utilidad: Number(row.utilidad),
    notes: row.notes ?? "",
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const rows = await query<any[]>(`SELECT * FROM aiu_configs ORDER BY updated_at DESC`);
    return NextResponse.json(rows.map(r));
  } catch (e: any) {
    console.error("[aiu-configs GET]", e?.code, e?.message);
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
    const admin = Number(body.administration ?? 0);
    const imp = Number(body.imprevistos ?? 0);
    const util = Number(body.utilidad ?? 0);
    const check = validateAiu(admin, imp, util);
    if (!check.ok) return NextResponse.json({ error: check.message }, { status: 400 });
    const id = randomUUID();
    await query(
      `INSERT INTO aiu_configs (id, project_id, administration, imprevistos, utilidad, notes, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, body.projectId, admin, imp, util, body.notes ?? null, (auth as AuthSuccess).userId],
    );
    return NextResponse.json({ id, ...body }, { status: 201 });
  } catch (e: any) {
    console.error("[aiu-configs POST]", e?.code, e?.message);
    if (e?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Ya existe configuración AIU para este proyecto" }, { status: 409 });
    }
    if (e?.code === "ER_CHECK_CONSTRAINT_VIOLATED") {
      return NextResponse.json({ error: "Cada componente debe estar entre 0% y 100%" }, { status: 400 });
    }
    return NextResponse.json({ error: "Error al crear AIU" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireRole("ADMIN","GERENTE","DIRECTOR","RESIDENTE","CONTABILIDAD","TESORERIA","HSEQ");
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const current = await query<any[]>(
      `SELECT administration, imprevistos, utilidad FROM aiu_configs WHERE id = ?`,
      [body.id],
    );
    if (!current.length) return NextResponse.json({ error: "AIU no existe" }, { status: 404 });
    const check = validateAiu(
      Number(body.administration ?? current[0].administration),
      Number(body.imprevistos ?? current[0].imprevistos),
      Number(body.utilidad ?? current[0].utilidad),
    );
    if (!check.ok) return NextResponse.json({ error: check.message }, { status: 400 });
    const sets: string[] = []; const args: any[] = [];
    for (const [k, c] of Object.entries({
      administration: "administration", imprevistos: "imprevistos",
      utilidad: "utilidad", notes: "notes",
    })) {
      if (body[k] !== undefined) {
        sets.push(`${c} = ?`);
        args.push(k === "notes" ? body[k] : Number(body[k]));
      }
    }
    if (!sets.length) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    sets.push("updated_by = ?"); args.push((auth as AuthSuccess).userId);
    args.push(body.id);
    await query(`UPDATE aiu_configs SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[aiu-configs PUT]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}
