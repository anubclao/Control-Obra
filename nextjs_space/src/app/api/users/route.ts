export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * CRUD: /api/users — usuarios del sistema
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";


function r(row: any) {
  return {
    id: row.id, email: row.email, name: row.name,
    role: row.role, area: row.area,
    avatarUrl: row.avatar_url ?? null,
    isActive: row.is_active === 1,
    lastLoginAt: row.last_login_at,
  };
}

export async function GET() {
  try {
    const rows = await query<any[]>(`SELECT * FROM users ORDER BY name ASC`);
    return NextResponse.json(rows.map(r));
  } catch (e: any) {
    console.error("[users GET]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.email || !body?.name || !body?.role || !body?.area) {
      return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
    }
    const id = require("crypto").randomUUID();
    await query(
      `INSERT INTO users (id, email, name, role, area, is_active) VALUES (?, ?, ?, ?, ?, 1)`,
      [id, body.email.toLowerCase(), body.name, body.role, body.area],
    );
    return NextResponse.json({ id, ...body }, { status: 201 });
  } catch (e: any) {
    console.error("[users POST]", e?.code, e?.message);
    if (e?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
    }
    return NextResponse.json({ error: "Error al crear usuario" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const sets: string[] = []; const args: any[] = [];
    for (const k of ["name", "role", "area"]) {
      if (body[k] !== undefined) { sets.push(`${k} = ?`); args.push(body[k]); }
    }
    if (body.isActive !== undefined) { sets.push("is_active = ?"); args.push(body.isActive ? 1 : 0); }
    if (!sets.length) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    args.push(body.id);
    await query(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[users PUT]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}
