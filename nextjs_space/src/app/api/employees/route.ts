export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * CRUD: /api/employees — RRHH
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth, requireRole, requireAdmin, authFailureResponse } from "@/lib/api-auth";


function r(row: any) {
  return {
    id: row.id,
    employeeNumber: row.employee_number,
    fullName: row.full_name,
    documentId: row.document_id,
    position: row.position,
    department: row.department,
    contractType: row.contract_type,
    startDate: row.start_date,
    endDate: row.end_date,
    salary: row.salary != null ? Number(row.salary) : null,
    eps: row.eps ?? "",
    pensionFund: row.pension_fund ?? "",
    arl: row.arl ?? "",
    riskLevel: row.risk_level,
    bankName: row.bank_name ?? "",
    accountType: row.account_type,
    accountNumber: row.account_number ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    status: row.status,
    userId: row.user_id,
    createdAt: row.created_at,
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
      `SELECT * FROM employees ${where} ORDER BY full_name ASC`, args,
    );
    return NextResponse.json(rows.map(r));
  } catch (e: any) {
    console.error("[employees GET]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN","GERENTE","DIRECTOR","RESIDENTE","CONTABILIDAD","TESORERIA","HSEQ");
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.fullName || !body?.documentId || !body?.position ||
        !body?.department || !body?.contractType || !body?.startDate) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }
    const id = randomUUID();
    const num = `EMP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    await query(
      `INSERT INTO employees
       (id, employee_number, full_name, document_id, position, department,
        contract_type, start_date, end_date, salary, eps, pension_fund, arl,
        risk_level, bank_name, account_type, account_number, email, phone, status, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, num, body.fullName, body.documentId, body.position, body.department,
       body.contractType, body.startDate, body.endDate ?? null,
       body.salary ? Number(body.salary) : null,
       body.eps ?? null, body.pensionFund ?? null, body.arl ?? null,
       body.riskLevel ?? null, body.bankName ?? null,
       body.accountType ?? null, body.accountNumber ?? null,
       body.email ?? null, body.phone ?? null,
       body.status ?? "ACTIVE", body.userId ?? null],
    );
    return NextResponse.json({ id, ...body, employeeNumber: num }, { status: 201 });
  } catch (e: any) {
    console.error("[employees POST]", e?.code, e?.message);
    if (e?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Ya existe un empleado con ese documento" }, { status: 409 });
    }
    return NextResponse.json({ error: "Error al crear empleado" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireRole("ADMIN","GERENTE","DIRECTOR","RESIDENTE","CONTABILIDAD","TESORERIA","HSEQ");
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const m: Record<string, string> = {
      fullName: "full_name", documentId: "document_id", position: "position",
      department: "department", contractType: "contract_type", startDate: "start_date",
      endDate: "end_date", salary: "salary", eps: "eps", pensionFund: "pension_fund",
      arl: "arl", riskLevel: "risk_level", bankName: "bank_name",
      accountType: "account_type", accountNumber: "account_number",
      email: "email", phone: "phone", status: "status", userId: "user_id",
    };
    const sets: string[] = []; const args: any[] = [];
    for (const [k, c] of Object.entries(m)) {
      if (body[k] !== undefined) {
        sets.push(`${c} = ?`);
        args.push(k === "salary" && body[k] != null ? Number(body[k]) : body[k]);
      }
    }
    if (!sets.length) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    args.push(body.id);
    await query(`UPDATE employees SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[employees PUT]", e?.code, e?.message);
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
    await query("DELETE FROM employees WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[employees DELETE]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
