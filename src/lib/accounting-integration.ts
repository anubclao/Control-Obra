// filepath: src/lib/accounting-integration.ts
// Helpers de auto-creacion de asientos contables (Fase 1 + 2).
//
// Por que existe: el modulo /api/accounting/ existia pero estaba
// desarticulado del resto del sistema. Cuando un pago pasaba a PAID,
// un corte a APPROVED, o un gasto de obra a PAGADO, NO se creaba
// ningun movimiento contable. Esto hacia que el panel contable
// quedara vacio aunque la empresa llevara operando semanas.
//
// Aqui centralizamos la logica de auto-creacion para que las tres
// rutas (/api/payments, /api/cuts, /api/expenses) llamen al mismo
// helper. Garantiza:
//   - Idempotencia: UNIQUE (expense_source_type, expense_source_id)
//     evita duplicar el asiento si la ruta se llama dos veces.
//   - Validacion previa: accountId activo y existente, projectId no
//     eliminado, FK valido. Si falla, devuelve error explicito (no 500).
//   - Trazabilidad: el expense contable queda enlazado al origen via
//     expense_source_type + expense_source_id.

import { randomUUID } from "node:crypto";
import type { PoolConnection } from "mysql2/promise";
import { query } from "./db";

export type AccountingSourceKind = "PAYMENT_REQUEST" | "EXPENSE" | "WORK_CUT";

export interface SyncExpenseArgs {
  /** Quien ejecuta la accion. Va a accounting_expenses.created_by. */
  userId: string;
  /** Tipo de origen para idempotencia. */
  sourceType: AccountingSourceKind;
  /** ID del origen (mismo valor que expense_source_id). */
  sourceId: string;
  /** Fecha del movimiento contable (YYYY-MM-DD). */
  date: string;
  /** Proyecto al que imputar el gasto (puede ser null = General). */
  projectId: string | null;
  /** Centro de costo libre (ej: "Obra", "Administracion", "Comercial"). */
  costCenter: string;
  /** Responsable textual del gasto. */
  responsible: string;
  /** Concepto del gasto. Para pagos: "Pago PAG-####". Para cortes: "Corte #N". */
  concept: string;
  /** Detalle adicional libre (description del pago, items del corte, etc.). */
  detail: string | null;
  /** Monto del gasto (positivo). */
  amount: number;
  /** Cuenta bancaria donde sale el dinero (FK accounting_accounts). */
  accountId: string;
}

/** Codigos de error que las API routes pueden traducir a 400/409. */
export type SyncExpenseErrorCode =
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_INACTIVE"
  | "PROJECT_NOT_FOUND"
  | "PROJECT_DELETED";

export type SyncExpenseResult =
  | { ok: true; expenseId: string; created: boolean }
  | { ok: false; code: SyncExpenseErrorCode; error: string };

export type SyncExpenseStatus = "POR_PAGAR" | "PAGADO";

/**
 * Variante para cortes aprobados (Fase 1.3):
 *  - Crea el movimiento contable en POR_PAGAR (no PAGADO todavia).
 * - Cuando el pago asociado se pague (Fase 1.2 en /api/payments), el
 *    helper hace UPDATE a PAGADO y rellena account_id.
 *  - Asi el panel contable muestra el valor ejecutado del corte en
 *    cuanto ADMIN lo aprueba, sin esperar el cierre de pago.
 */
export async function syncExpenseOnCutApprove(
  args: Omit<SyncExpenseArgs, "accountId">,
  conn?: PoolConnection,
): Promise<SyncExpenseResult> {
  const runQuery = (conn
    ? (sql: string, params: unknown[]) => conn.execute(sql, params as any)
    : async (sql: string, params: unknown[]) => {
        const [rows] = await query<any[]>(sql, params as any);
        return [rows];
      }) as (sql: string, params: unknown[]) => Promise<any>;

  // Idempotencia
  const [existingRows] = (await runQuery(
    `SELECT id FROM accounting_expenses
      WHERE expense_source_type = ? AND expense_source_id = ?
     LIMIT 1`,
    [args.sourceType, args.sourceId],
  )) as any[];
  if (existingRows && existingRows.length) {
    return { ok: true, expenseId: existingRows[0].id, created: false };
  }

  // Validar proyecto
  if (args.projectId) {
    const [projectRows] = (await runQuery(
      `SELECT id, deleted_at FROM projects WHERE id = ? LIMIT 1`,
      [args.projectId],
    )) as any[];
    if (!projectRows || !projectRows.length) {
      return {
        ok: false,
        code: "PROJECT_NOT_FOUND",
        error: `El proyecto ${args.projectId} no existe`,
      };
    }
    if (projectRows[0].deleted_at) {
      return {
        ok: false,
        code: "PROJECT_DELETED",
        error: `El proyecto ${args.projectId} esta eliminado`,
      };
    }
  }

  const expenseId = randomUUID();
  await runQuery(
    `INSERT INTO accounting_expenses
       (id, date, project_id, cost_center, responsible, provider_name,
        concept, detail, amount, status, account_id,
        expense_source_type, expense_source_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'POR_PAGAR', NULL,
             ?, ?, ?)`,
    [
      expenseId,
      args.date,
      args.projectId,
      args.costCenter,
      args.responsible,
      "",
      args.concept,
      args.detail,
      args.amount,
      args.sourceType,
      args.sourceId,
      args.userId,
    ],
  );

  return { ok: true, expenseId, created: true };
}

/**
 * Marca un expense previamente creado (POR_PAGAR) como PAGADO y le
 * asigna la cuenta contable. Usado en pagos que provienen de cortes:
 * el helper de Fase 1.2 hace el INSERT directo, pero si ya existe un
 * POR_PAGAR (creado por syncExpenseOnCutApprove), este UPDATE lo
 * cierra y lo vincula a la cuenta.
 */
export async function closeExpenseFromPayment(
  sourceType: AccountingSourceKind,
  sourceId: string,
  accountId: string,
  conn?: PoolConnection,
): Promise<{ found: boolean }> {
  const runQuery = (conn
    ? (sql: string, params: unknown[]) => conn.execute(sql, params as any)
    : async (sql: string, params: unknown[]) => {
        const [rows] = await query<any[]>(sql, params as any);
        return [rows];
      }) as (sql: string, params: unknown[]) => Promise<any>;

  await runQuery(
    `UPDATE accounting_expenses
        SET status = 'PAGADO', account_id = ?
      WHERE expense_source_type = ?
        AND expense_source_id = ?
        AND status = 'POR_PAGAR'`,
    [accountId, sourceType, sourceId],
  );
  return { found: true };
}

/**
 * Inserta un `accounting_expenses` PAGADO enlazado a su origen real.
 * Idempotente: si ya existe un expense para (sourceType, sourceId),
 * devuelve created=false sin error. Valida cuenta y proyecto antes
 * del INSERT para responder 400 explicito en lugar de 500.
 *
 * Acepta una conexion opcional `conn` para participar en una
 * transaccion ya abierta (caso comun: payments PATCH dentro de un
 * transaction()). Si no se pasa, abre una nueva.
 */
export async function syncExpenseOnPayment(
  args: SyncExpenseArgs,
  conn?: PoolConnection,
): Promise<SyncExpenseResult> {
  // 0) Idempotencia: si ya existe un expense para este origen, no duplica.
  const runQuery = (conn
    ? (sql: string, params: unknown[]) => conn.execute(sql, params as any)
    : async (sql: string, params: unknown[]) => {
        const [rows] = await query<any[]>(sql, params as any);
        return [rows];
      }) as (sql: string, params: unknown[]) => Promise<any>;

  const [existingRows] = (await runQuery(
    `SELECT id FROM accounting_expenses
      WHERE expense_source_type = ? AND expense_source_id = ?
     LIMIT 1`,
    [args.sourceType, args.sourceId],
  )) as any[];
  if (existingRows && existingRows.length) {
    return { ok: true, expenseId: existingRows[0].id, created: false };
  }

  // 1) Validar cuenta: existe y esta activa.
  const [accountRows] = (await runQuery(
    `SELECT id, is_active FROM accounting_accounts WHERE id = ? LIMIT 1`,
    [args.accountId],
  )) as any[];
  if (!accountRows || !accountRows.length) {
    return {
      ok: false,
      code: "ACCOUNT_NOT_FOUND",
      error: `La cuenta contable ${args.accountId} no existe`,
    };
  }
  if (Number(accountRows[0].is_active) !== 1) {
    return {
      ok: false,
      code: "ACCOUNT_INACTIVE",
      error: `La cuenta contable ${args.accountId} esta inactiva. Activala antes de pagar.`,
    };
  }

  // 2) Validar proyecto: si viene projectId, debe existir y no estar soft-deleted.
  if (args.projectId) {
    const [projectRows] = (await runQuery(
      `SELECT id, deleted_at FROM projects WHERE id = ? LIMIT 1`,
      [args.projectId],
    )) as any[];
    if (!projectRows || !projectRows.length) {
      return {
        ok: false,
        code: "PROJECT_NOT_FOUND",
        error: `El proyecto ${args.projectId} no existe`,
      };
    }
    if (projectRows[0].deleted_at) {
      return {
        ok: false,
        code: "PROJECT_DELETED",
        error: `El proyecto ${args.projectId} esta eliminado (soft delete). No se puede imputar gastos.`,
      };
    }
  }

  // 3) Insertar el movimiento contable PAGADO.
  const expenseId = randomUUID();
  await runQuery(
    `INSERT INTO accounting_expenses
       (id, date, project_id, cost_center, responsible, provider_name,
        concept, detail, amount, status, account_id,
        expense_source_type, expense_source_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAGADO', ?, ?, ?, ?)`,
    [
      expenseId,
      args.date,
      args.projectId,
      args.costCenter,
      args.responsible,
      "", // provider_name: se puede enriquecer despues si hay un campo origen
      args.concept,
      args.detail,
      args.amount,
      args.accountId,
      args.sourceType,
      args.sourceId,
      args.userId,
    ],
  );

  return { ok: true, expenseId, created: true };
}