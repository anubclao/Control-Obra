export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * CRUD: /api/invitations
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth, requireRole, requireAdmin, authFailureResponse } from "@/lib/api-auth";
import crypto from "node:crypto";


function r(row: any) {
  return {
    id: row.id,
    code: row.code,
    email: row.email,
    role: row.role,
    area: row.area,
    projectId: row.project_id,
    status: row.status,
    maxUses: row.max_uses,
    uses: row.uses,
    expiresAt: row.expires_at,
    createdBy: row.created_by,
    acceptedBy: row.accepted_by,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
  };
}

function makeCode(): string {
  // Genera código de 10 chars usando CSPRNG (crypto.randomInt) en lugar de
  // Math.random() — los códigos son secretos autoritativos para aceptar
  // invitaciones, predecibilidad = bypass.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const charsLen = chars.length;
  let s = "";
  for (let i = 0; i < 10; i++) {
    s += chars[crypto.randomInt(0, charsLen)];
  }
  return s;
}

export async function GET() {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const rows = await query<any[]>(`SELECT * FROM invitations ORDER BY created_at DESC`);
    return NextResponse.json(rows.map(r));
  } catch (e: any) {
    console.error("[invitations GET]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN","GERENTE","DIRECTOR","RESIDENTE","CONTABILIDAD","TESORERIA","HSEQ");
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.email || !body?.role) {
      return NextResponse.json({ error: "email y role requeridos" }, { status: 400 });
    }
    const id = randomUUID();
    const code = body.code ?? makeCode();
    const expiresAt = body.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 19).replace("T", " ");
    await query(
      `INSERT INTO invitations (id, code, email, role, area, project_id, status, max_uses, uses, expires_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, 0, ?, ?)`,
      [id, code, body.email.toLowerCase(), body.role, body.area ?? null,
       body.projectId ?? null, Number(body.maxUses ?? 1),
       expiresAt, body.createdBy ?? null],
    );
    return NextResponse.json({ id, ...body, code, expiresAt }, { status: 201 });
  } catch (e: any) {
    console.error("[invitations POST]", e?.code, e?.message);
    if (e?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Ese código ya existe, genera otro" }, { status: 409 });
    }
    return NextResponse.json({ error: "Error al crear invitación" }, { status: 500 });
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
    if (body.status !== undefined) { sets.push("status = ?"); args.push(body.status); }
    if (body.maxUses !== undefined) { sets.push("max_uses = ?"); args.push(Number(body.maxUses)); }
    if (!sets.length) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    args.push(body.id);
    await query(`UPDATE invitations SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[invitations PUT]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    await query("DELETE FROM invitations WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[invitations DELETE]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
