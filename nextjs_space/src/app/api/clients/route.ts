export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * CRUD: /api/clients
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";


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
    createdAt: row.created_at,
  };
}

export async function GET() {
  try {
    const rows = await query<any[]>(`SELECT * FROM clients ORDER BY company_name ASC`);
    return NextResponse.json(rows.map(r));
  } catch (e: any) {
    console.error("[clients GET]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.companyName || !body?.contactName || !body?.email || !body?.phone ||
        !body?.city || !body?.source) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }
    const id = require("crypto").randomUUID();
    const num = `CLI-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    await query(
      `INSERT INTO clients
       (id, client_number, company_name, nit, contact_name, email, phone, city,
        sector, source, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, num, body.companyName, body.nit ?? null, body.contactName, body.email,
       body.phone, body.city, body.sector ?? null, body.source,
       body.status ?? "PROSPECT", body.notes ?? null],
    );
    return NextResponse.json({ id, ...body, clientNumber: num }, { status: 201 });
  } catch (e: any) {
    console.error("[clients POST]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al crear cliente" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const m: Record<string, string> = {
      companyName: "company_name", nit: "nit", contactName: "contact_name",
      email: "email", phone: "phone", city: "city", sector: "sector",
      source: "source", status: "status", notes: "notes",
    };
    const sets: string[] = []; const args: any[] = [];
    for (const [k, c] of Object.entries(m)) {
      if (body[k] !== undefined) { sets.push(`${c} = ?`); args.push(body[k]); }
    }
    if (!sets.length) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    args.push(body.id);
    await query(`UPDATE clients SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[clients PUT]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    await query("DELETE FROM clients WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[clients DELETE]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
