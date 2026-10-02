/**
 * lib/advances.ts
 *
 * Calculo del saldo de anticipo por contrato.
 *
 * P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.1):
 *   Antes `advanceDeduction` en cada corte era un numero libre que
 *   podia no cuadrar con los anticipos pagados. Aqui concentramos la
 *   formula: para un contrato, el anticipo autorizado es
 *   `value * advance_percent / 100`; el anticipo ya desembolsado
 *   sale de la suma de pagos tipo ANTICIPO en estado PAID; el saldo
 *   es la diferencia.
 *
 * El helper es puro: recibe una conexion mysql2/promise para poder
 * llamarse desde una transaccion o desde un endpoint de lectura.
 */

import type { PoolConnection } from "mysql2/promise";

export interface AdvanceBalance {
  /** ID del contrato. */
  contractId: string;
  /** Valor total del contrato. */
  contractValue: number;
  /** Porcentaje autorizado como anticipo (0-100). */
  advancePercent: number;
  /** anticipo autorizado = contractValue * advancePercent / 100 */
  authorized: number;
  /** Suma de pagos tipo ANTICIPO en estado PAID. */
  disbursed: number;
  /** authorized - disbursed; puede ser negativo si se ha pagado de mas. */
  remaining: number;
}

/**
 * Suma todos los pagos ANTICIPO PAID para un contrato y devuelve el
 * saldo. Pensado para alimentar el formulario del corte y mostrar
 * cuanto se puede amortizar todavia.
 *
 * Si el contrato no existe, devuelve un balance con todos los campos en 0.
 */
export async function computeAdvanceBalance(
  conn: Pick<PoolConnection, "execute">,
  contractId: string,
): Promise<AdvanceBalance> {
  const [contractRows] = await conn.execute(
    `SELECT value, advance_percent FROM contracts WHERE id = ?`,
    [contractId],
  );
  const contractArr = contractRows as any[];
  if (!contractArr.length) {
    return {
      contractId,
      contractValue: 0,
      advancePercent: 0,
      authorized: 0,
      disbursed: 0,
      remaining: 0,
    };
  }
  const contractValue = Number(contractArr[0].value ?? 0);
  const advancePercent = Number(contractArr[0].advance_percent ?? 0);
  const authorized = (contractValue * advancePercent) / 100;

  // Pagos ANTICIPO del contrato, solo en estado PAID.
  const [paymentRows] = await conn.execute(
    `SELECT COALESCE(SUM(amount), 0) AS total
       FROM payment_requests
      WHERE type = 'ANTICIPO'
        AND status = 'PAID'
        AND project_id IN (SELECT project_id FROM contracts WHERE id = ?)`,
    [contractId],
  );
  const paymentArr = paymentRows as any[];
  const disbursed = Number(paymentArr[0]?.total ?? 0);

  return {
    contractId,
    contractValue,
    advancePercent,
    authorized,
    disbursed,
    remaining: authorized - disbursed,
  };
}

/**
 * Devuelve el anticipo maximo amortizable en un nuevo corte: es el
 * minimo entre el saldo restante y el valor a pagar del corte.
 * Si el contrato no tiene anticipo autorizado, devuelve 0.
 */
export function suggestAdvanceDeduction(
  balance: AdvanceBalance,
  netValue: number,
): number {
  if (balance.remaining <= 0) return 0;
  return Math.min(balance.remaining, Math.max(netValue, 0));
}
