export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * CRUD: /api/providers
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth, requireRole, requireAdmin, authFailureResponse } from "@/lib/api-auth";
import { validateProviderNit, type ProviderNitRef } from "@/lib/providers-validation";


function r(r: any, docs: any[] = []) {
  return {
    id: r.id,
    personType: r.person_type,
    name: r.name,
    nit: r.nit,
    contact: r.contact,
    email: r.email,
    email2: r.email2 ?? "",
    phone: r.phone,
    phone2: r.phone2 ?? "",
    website: r.website ?? "",
    address: r.address ?? "",
    city: r.city ?? "",
    department: r.department ?? "",
    postalCode: r.postal_code ?? "",
    category: r.category,
    subcategory: r.subcategory ?? "",
    subcategoryOther: r.subcategory_other ?? "",
    legalRepName: r.legal_rep_name ?? "",
    legalRepCedula: r.legal_rep_cedula ?? "",
    legalRepEmail: r.legal_rep_email ?? "",
    legalRepPhone: r.legal_rep_phone ?? "",
    reportedIncome: Number(r.reported_income ?? 0),
    incomeYear: r.income_year ?? null,
    status: r.status,
    rating: r.rating ?? null,
    notes: r.notes ?? "",
    // P0 plan 2026-10-13 (Corte 4 — defensive references): tabla provider_references
    // existe en DB pero r.references siempre undefined porque la columna no
    // está en providers. Devolvemos array vacío para que el contrato sea
    // explícito y futuros usos no crasheen. Corte 6 implementará el JOIN real.
    references: r.references ?? [],
    // P0 plan 2026-10-08 (fix bug proveedores): la UI hace p.documents.length.
    // Antes esto era undefined y la pagina crasheaba con TypeError.
    // AC-10 (Corte 12 — P0 bugfix): NO devolvemos file_url. La URL de SharePoint
    // es accesible solo via el endpoint de download con auth. La UI pide el
    // documento via /api/providers/[id]/documents/[docId]/download.
    documents: docs.map((d) => ({
      id: d.id,
      type: d.type,
      fileName: d.file_name,
      uploadedAt: d.uploaded_at,
      expirationDate: d.expiration_date,
    })),
  };
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const where = status ? "WHERE status = ?" : "";
    const args = status ? [status] : [];
    const rows = await query<any[]>(
      `SELECT * FROM providers ${where} ORDER BY name ASC`,
      args,
    );
    // P0 plan 2026-10-08: JOIN con provider_documents para devolver documents.
    // AC-10 (Corte 12 — P0 bugfix): columnas EXPLICITAS (no SELECT *). La
    // URL de SharePoint solo se obtiene via el endpoint de download con auth.
    const ids = rows.map((p) => p.id);
    const placeholders = ids.length ? ids.map(() => "?").join(",") : "''";
    const docs = ids.length
      ? await query<any[]>(
          `SELECT id, provider_id, type, file_name, uploaded_at, expiration_date
           FROM provider_documents
           WHERE provider_id IN (${placeholders})
           ORDER BY uploaded_at DESC`,
          ids,
        )
      : [];
    const docsByProvider = new Map<string, any[]>();
    for (const d of docs) {
      const list = docsByProvider.get(d.provider_id) ?? [];
      list.push(d);
      docsByProvider.set(d.provider_id, list);
    }
    return NextResponse.json(
      rows.map((row) => r(row, docsByProvider.get(row.id) ?? [])),
    );
  } catch (e: any) {
    console.error("[providers GET]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN","GERENTE","DIRECTOR","RESIDENTE","CONTABILIDAD","TESORERIA","HSEQ");
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.name || !body?.nit || !body?.personType) {
      return NextResponse.json(
        { error: "name, nit, personType son obligatorios" },
        { status: 400 },
      );
    }
    // AC-1/AC-4: unicidad sobre el NIT normalizado (el UNIQUE de MySQL compara
    // la cadena literal, así que "900.111.222-3" y "9001112223" lo esquivan).
    const existing = (await query<any[]>(
      "SELECT id, name, nit FROM providers",
    )) as ProviderNitRef[];
    const nitCheck = validateProviderNit(existing, body.nit);
    if (!nitCheck.ok) {
      return NextResponse.json(
        { error: nitCheck.error, code: nitCheck.code },
        { status: nitCheck.code === "NIT_DUPLICATED" ? 409 : 400 },
      );
    }

    const id = randomUUID();
    await query(
      `INSERT INTO providers
        (id, person_type, name, nit, contact, email, email2, phone, phone2,
         website, address, city, department, postal_code, category,
         subcategory, subcategory_other, legal_rep_name, legal_rep_cedula,
         legal_rep_email, legal_rep_phone, reported_income, income_year,
         status, rating, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.personType, body.name, body.nit,
        body.contact ?? "", body.email ?? "", body.email2 ?? null,
        body.phone ?? "", body.phone2 ?? null,
        body.website ?? null, body.address ?? null,
        body.city ?? null, body.department ?? null, body.postalCode ?? null,
        body.category ?? null, body.subcategory ?? null, body.subcategoryOther ?? null,
        body.legalRepName ?? null, body.legalRepCedula ?? null,
        body.legalRepEmail ?? null, body.legalRepPhone ?? null,
        Number(body.reportedIncome ?? 0), body.incomeYear ?? null,
        body.status ?? "INCOMPLETE", body.rating ?? null,
        body.notes ?? null,
      ],
    );
    return NextResponse.json({ id, ...body }, { status: 201 });
  } catch (e: any) {
    console.error("[providers POST]", e?.code, e?.message);
    if (e?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "Ya existe un proveedor con ese NIT" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Error al crear proveedor" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireRole("ADMIN","GERENTE","DIRECTOR","RESIDENTE","CONTABILIDAD","TESORERIA","HSEQ");
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    // AC-2: al cambiar el NIT se valida contra los OTROS proveedores, nunca
    // contra sí mismo.
    if (body.nit !== undefined) {
      const existing = (await query<any[]>(
        "SELECT id, name, nit FROM providers",
      )) as ProviderNitRef[];
      const nitCheck = validateProviderNit(existing, body.nit, body.id);
      if (!nitCheck.ok) {
        return NextResponse.json(
          { error: nitCheck.error, code: nitCheck.code },
          { status: nitCheck.code === "NIT_DUPLICATED" ? 409 : 400 },
        );
      }
    }

    const map: Record<string, string> = {
      personType: "person_type", name: "name", nit: "nit",
      contact: "contact", email: "email", email2: "email2",
      phone: "phone", phone2: "phone2", website: "website",
      address: "address", city: "city", department: "department",
      postalCode: "postal_code", category: "category",
      subcategory: "subcategory", subcategoryOther: "subcategory_other",
      legalRepName: "legal_rep_name", legalRepCedula: "legal_rep_cedula",
      legalRepEmail: "legal_rep_email", legalRepPhone: "legal_rep_phone",
      reportedIncome: "reported_income", incomeYear: "income_year",
      status: "status", rating: "rating", notes: "notes",
    };
    const sets: string[] = [];
    const args: any[] = [];
    for (const [k, vCol] of Object.entries(map)) {
      if (body[k] !== undefined) {
        sets.push(`${vCol} = ?`);
        args.push(k === "reportedIncome" ? Number(body[k]) : body[k]);
      }
    }
    if (!sets.length) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    args.push(body.id);
    await query(`UPDATE providers SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[providers PUT]", e?.code, e?.message);
    if (e?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "NIT ya está registrado en otro proveedor" },
        { status: 409 },
      );
    }
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
    await query("DELETE FROM providers WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[providers DELETE]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
