/**
 * lib/counters.ts
 *
 * Genera consecutivos unicos por tipo y anio (PAG-, CO-, CLI-, COT-...).
 *
 * P2 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.1):
 *   Antes cada POST generaba el numero con `Date.now().toString(36)`
 *   recortado. Eso podia colisionar y nunca era secuencial. Ahora la
 *   tabla `counters` lleva (entity, year, last_number) y este helper
 *   hace `INSERT ... ON DUPLICATE KEY UPDATE` para atomico.
 *
 * Pensado para correr dentro de una transaccion (recibe una conexion).
 */

import type { PoolConnection } from "mysql2/promise";

export type SequenceEntity =
  | "PAG"
  | "CO"
  | "CLI"
  | "COT"
  | "BUDGET"
  | "PSC"
  | "CONTRACT";

const PAD_BY_ENTITY: Record<SequenceEntity, number> = {
  PAG: 5,
  CO: 6,
  CLI: 6,
  COT: 6,
  BUDGET: 4,
  PSC: 4,
  CONTRACT: 4,
};

export interface NextSequenceResult {
  /** Numero formateado, por ejemplo "PAG-2026-00042". */
  number: string;
  /** Numero entero generado, util para diagnostico. */
  sequence: number;
  year: number;
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, "0");
}

/**
 * Reserva el siguiente numero para una entidad en el anio actual.
 * Si la fila no existe, la crea; si existe, incrementa last_number.
 *
 * Devuelve un NextSequenceResult con el numero formateado
 * `${prefix}-${year}-${padded}`.
 */
export async function nextSequence(
  conn: Pick<PoolConnection, "execute">,
  entity: SequenceEntity,
  year: number = new Date().getFullYear(),
): Promise<NextSequenceResult> {
  const padding = PAD_BY_ENTITY[entity] ?? 5;
  await conn.execute(
    `INSERT INTO counters (entity, year, prefix, last_number)
     VALUES (?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE entity = entity`,
    [entity, year, entity],
  );
  await conn.execute(
    `UPDATE counters
        SET last_number = last_number + 1
      WHERE entity = ? AND year = ?`,
    [entity, year],
  );
  const [rows] = await conn.execute(
    `SELECT last_number FROM counters WHERE entity = ? AND year = ?`,
    [entity, year],
  );
  const arr = rows as any[];
  const sequence = Number(arr[0]?.last_number ?? 0);
  return {
    number: `${entity}-${year}-${pad(sequence, padding)}`,
    sequence,
    year,
  };
}
