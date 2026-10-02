export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * CRUD: /api/beneficiary-accounts
 *
 * P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.2):
 *   Centraliza las cuentas bancarias de los proveedores. Cada fila guarda
 *   el numero de cuenta cifrado (AES-256-GCM) y los ultimos 4 digitos
 *   para poder mostrarlos en listados sin descifrar.
 *
 * Roles: lectura para cualquiera con sesion; escritura para los 7
 * roles internos (mismo whitelist que el resto del modulo). Borrado
 * fisico no se permite: solo soft delete via DELETE.
 */
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import {
  requireAuth,
  requireRole,
  authFailureResponse,
  type AuthSuccess,
} from "@/lib/api-auth";
import { encryptColumn, decryptColumn } from "@/lib/crypto";

function last4(accountNumber: string): string {
  return accountNumber.slice(-4).padStart(4, "0");
}

function r(row: any) {
  return {
    id: row.id,
    providerId: row.provider_id,
    bankName: row.bank_name,
    accountType: row.account_type,
    accountNumberLast4: row.account_number_last4,
    isDefault: row.is_default === 1 || row.is_default === true,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const url = new URL(req.url);
    const providerId = url.searchParams.get("providerId");
    const where: string[] = ["deleted_at IS NULL"];
    const args: any[] = [];
    if (providerId) {
      where.push("provider_id = ?");
      args.push(providerId);
    }
    const rows = await query<any[]>(
      `SELECT * FROM beneficiary_accounts
        WHERE ${where.join(" AND ")}
        ORDER BY is_default DESC, created_at DESC`,
      args,
    );
    return NextResponse.json(rows.map(r));
  } catch (e: any) {
    console.error("[beneficiary-accounts GET]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(
    "ADMIN",
    "GERENTE",
    "DIRECTOR",
    "RESIDENTE",
    "CONTABILIDAD",
    "TESORERIA",
    "HSEQ",
  );
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (
      !body?.providerId ||
      !body?.bankName ||
      !body?.accountType ||
      !body?.accountNumber
    ) {
      return NextResponse.json(
        {
          error:
            "providerId, bankName, accountType y accountNumber son obligatorios",
        },
        { status: 400 },
      );
    }
    if (body.accountType !== "SAVINGS" && body.accountType !== "CHECKING") {
      return NextResponse.json(
        { error: "accountType debe ser SAVINGS o CHECKING" },
        { status: 400 },
      );
    }
    const cipher = encryptColumn(body.accountNumber);
    if (!cipher) {
      return NextResponse.json(
        { error: "No se pudo cifrar la cuenta (sin clave de cifrado)" },
        { status: 500 },
      );
    }
    const { userId } = auth as AuthSuccess;
    const id = randomUUID();
    await query(
      `INSERT INTO beneficiary_accounts
         (id, provider_id, bank_name, account_type, account_number_cipher,
          account_number_last4, is_default, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.providerId,
        body.bankName,
        body.accountType,
        cipher,
        last4(body.accountNumber),
        body.isDefault ? 1 : 0,
        userId,
        userId,
      ],
    );
    return NextResponse.json(
      {
        id,
        providerId: body.providerId,
        bankName: body.bankName,
        accountType: body.accountType,
        accountNumberLast4: last4(body.accountNumber),
        isDefault: !!body.isDefault,
      },
      { status: 201 },
    );
  } catch (e: any) {
    console.error("[beneficiary-accounts POST]", e?.code, e?.message);
    if (e?.code === "ER_NO_REFERENCED_ROW_2") {
      return NextResponse.json(
        { error: "El proveedor no existe" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Error al crear cuenta" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  const auth = await requireRole(
    "ADMIN",
    "GERENTE",
    "DIRECTOR",
    "CONTABILIDAD",
    "TESORERIA",
  );
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }
    const { userId } = auth as AuthSuccess;
    const result = await query<any>(
      `UPDATE beneficiary_accounts
          SET deleted_at = CURRENT_TIMESTAMP,
              deleted_by = ?
        WHERE id = ? AND deleted_at IS NULL`,
      [userId, id],
    );
    const affected = (result as any)?.affectedRows ?? 0;
    if (affected === 0) {
      return NextResponse.json(
        { error: "Cuenta no encontrada o ya estaba archivada" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, softDeleted: true });
  } catch (e: any) {
    console.error("[beneficiary-accounts DELETE]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}

/**
 * Helper interno: descifra la cuenta principal de un proveedor. Pensado
 * para ser llamado desde otras rutas de servidor que necesiten el numero
 * completo (por ejemplo, al construir el comprobante de pago).
 */
export async function decryptDefaultAccount(
  providerId: string,
): Promise<string | null> {
  const rows = await query<any[]>(
    `SELECT account_number_cipher FROM beneficiary_accounts
      WHERE provider_id = ? AND is_default = 1 AND deleted_at IS NULL
      LIMIT 1`,
    [providerId],
  );
  if (!rows.length) return null;
  return decryptColumn(rows[0].account_number_cipher);
}
