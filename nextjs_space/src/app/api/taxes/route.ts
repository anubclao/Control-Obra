export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * CRUD: /api/taxes — configuración de impuestos
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";


function r(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    type: row.type,
    rate: Number(row.rate),
    appliesTo: row.applies_to,
    isActive: row.is_active === 1,
    notes: row.notes ?? "",
  };
}

export async function GET() {
  try {
    const rows = await query<any[]>(`SELECT * FROM tax_configs ORDER BY name ASC`);
    return NextResponse.json(rows.map(r));
  } catch (e: any) {
    console.error("[taxes GET]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.name || !body?.type || body?.rate === undefined) {
      return NextResponse.json({ error: "name, type, rate requeridos" }, { status: 400 });
    }
    const id = require("crypto").randomUUID();
    await query(
      `INSERT INTO tax_configs (id, project_id, name, type, rate, applies_to, is_active, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, body.projectId ?? null, body.name, body.type, Number(body.rate),
       body.appliesTo ?? "AMBOS", body.isActive === false ? 0 : 1,
       body.notes ?? null],
    );
    return NextResponse.json({ id, ...body }, { status: 201 });
  } catch (e: any) {
    console.error("[taxes POST]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al crear impuesto" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const sets: string[] = []; const args: any[] = [];
    if (body.name !== undefined) { sets.push("name = ?"); args.push(body.name); }
    if (body.rate !== undefined) { sets.push("rate = ?"); args.push(Number(body.rate)); }
    if (body.appliesTo !== undefined) { sets.push("applies_to = ?"); args.push(body.appliesTo); }
    if (body.isActive !== undefined) { sets.push("is_active = ?"); args.push(body.isActive ? 1 : 0); }
    if (body.notes !== undefined) { sets.push("notes = ?"); args.push(body.notes); }
    if (!sets.length) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    args.push(body.id);
    await query(`UPDATE tax_configs SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[taxes PUT]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    await query("DELETE FROM tax_configs WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[taxes DELETE]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
