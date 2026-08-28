export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * CRUD: /api/aiu-configs — AIU por proyecto
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth, requireRole, requireAdmin, authFailureResponse } from "@/lib/api-auth";


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
    if (Math.abs(admin + imp + util - 100) > 0.01) {
      return NextResponse.json(
        { error: `Administración + Imprevistos + Utilidad debe sumar 100% (actual: ${admin + imp + util}%)` },
        { status: 400 },
      );
    }
    const id = require("crypto").randomUUID();
    await query(
      `INSERT INTO aiu_configs (id, project_id, administration, imprevistos, utilidad, notes, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, body.projectId, admin, imp, util, body.notes ?? null, body.updatedBy ?? null],
    );
    return NextResponse.json({ id, ...body }, { status: 201 });
  } catch (e: any) {
    console.error("[aiu-configs POST]", e?.code, e?.message);
    if (e?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Ya existe configuración AIU para este proyecto" }, { status: 409 });
    }
    if (e?.code === "ER_CHECK_CONSTRAINT_VIOLATED") {
      return NextResponse.json({ error: "La suma debe ser exactamente 100%" }, { status: 400 });
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
    if (body.updatedBy) { sets.push("updated_by = ?"); args.push(body.updatedBy); }
    if (!sets.length) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    args.push(body.id);
    await query(`UPDATE aiu_configs SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[aiu-configs PUT]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}
