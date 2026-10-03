/**
 * src/lib/permissions-budget.ts
 *
 * Reglas de permiso para reemplazar o crear nueva version del
 * Presupuesto Tope (PT). Separado de `permissions.ts` (que tiene "use
 * client" para hooks de UI) para poder importar `query` desde el
 * servidor sin conflicto con la directiva de Next.
 *
 * SPEC: docs/specs/budget-upload-validation.md AC-3
 *
 * Por que este archivo existe:
 *   Hoy el flujo de upload de PT permite crear una nueva version encima
 *   del existente solo si el PT NO esta afectado. Si tiene cortes
 *   APPROVED/PAID o pagos PAID, solo el ADMIN puede reemplazarlo, para
 *   preservar la trazabilidad contable (no perder historial de obra ya
 *   ejecutada por un descuido al re-cargar el Excel).
 *
 * Uso en API route:
 *   import { getBudgetAffectedState, canReplaceBudget } from "@/lib/permissions-budget";
 *   const budget = await loadBudget(id);
 *   if (budget) {
 *     const affected = await getBudgetAffectedState(budget.id);
 *     if (!canReplaceBudget(user.role, affected)) {
 *       return NextResponse.json({ error: "..." }, { status: 403 });
 *     }
 *   }
 */

import { query } from "./db";
import type { Role } from "@/types";

export interface BudgetAffectedState {
  hasApprovedCuts: boolean;
  hasPaidPayments: boolean;
}

/**
 * Consulta el estado actual del PT: tiene cortes ya aprobados/pagados o
 * pagos en estado PAID? Cualquiera de las dos cuenta como "afectado".
 *
 * Fresh query cada vez (sin cache) — el spec dice "el estado real", no
 * queremos inconsistencias si un pago entra entre dos checks.
 */
export async function getBudgetAffectedState(
  budgetId: string,
): Promise<BudgetAffectedState> {
  const [cuts] = await query<any[]>(
    `SELECT 1 FROM work_cuts
      WHERE budget_id = ? AND status IN ('APPROVED', 'PAID') AND deleted_at IS NULL
      LIMIT 1`,
    [budgetId],
  );
  const [pays] = await query<any[]>(
    `SELECT 1 FROM payment_requests
      WHERE budget_id = ? AND status = 'PAID' AND deleted_at IS NULL
      LIMIT 1`,
    [budgetId],
  );
  return {
    hasApprovedCuts: !!cuts,
    hasPaidPayments: !!pays,
  };
}

/**
 * Determina si el usuario puede reemplazar o crear nueva version del PT.
 * Regla del spec AC-3:
 *   - ADMIN: siempre puede.
 *   - Cualquier otro rol: solo si el PT NO esta afectado (sin cortes
 *     APPROVED/PAID ni pagos PAID).
 *
 * Funcion pura (sin IO) para que sea trivial de testear.
 */
export function canReplaceBudget(
  userRole: Role,
  affected: BudgetAffectedState,
): boolean {
  if (userRole === "ADMIN") return true;
  return !affected.hasApprovedCuts && !affected.hasPaidPayments;
}