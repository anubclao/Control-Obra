/**
 * lib/aiu-constants.ts
 *
 * AIU = Administración, Imprevistos y Utilidad, cada uno como % SOBRE EL
 * COSTO DIRECTO (ej. cliente: A 8 %, I 5 %, U 5 %). El IVA (19 %) se liquida
 * solo sobre la utilidad.
 *
 * SPEC: docs/specs/bug-aiu-porcentaje-sobre-costo-directo.md
 */

/** IVA que se aplica sobre la Utilidad en contratos AIU. */
export const IVA_ON_UTILITY_PCT = 19;

export interface AiuPercents {
  administration: number;
  imprevistos: number;
  utilidad: number;
}

export function validateAiu(admin: number, imprev: number, util: number): {
  ok: boolean;
  total: number;
  message?: string;
} {
  const parts: Array<[string, number]> = [
    ["Administración", admin],
    ["Imprevistos", imprev],
    ["Utilidad", util],
  ];
  for (const [label, v] of parts) {
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      return { ok: false, total: NaN, message: `${label} debe estar entre 0% y 100%` };
    }
  }
  const total = admin + imprev + util;
  if (total > 100) {
    return {
      ok: false,
      total,
      message: `El AIU total no puede superar el 100% del costo directo (actual: ${total.toFixed(2)}%)`,
    };
  }
  return { ok: true, total };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Liquida el AIU sobre un costo directo. Cada componente se redondea a 2
 * decimales para mostrar; el total se calcula con los valores sin redondear y
 * se redondea al final (igual que el Excel del cliente).
 */
export function computeAiu(directCost: number, aiu: AiuPercents) {
  const cd = Number(directCost) || 0;
  const administration = (cd * (Number(aiu.administration) || 0)) / 100;
  const imprevistos = (cd * (Number(aiu.imprevistos) || 0)) / 100;
  const utilidad = (cd * (Number(aiu.utilidad) || 0)) / 100;
  const iva = (utilidad * IVA_ON_UTILITY_PCT) / 100;
  return {
    directCost: round2(cd),
    administration: round2(administration),
    imprevistos: round2(imprevistos),
    utilidad: round2(utilidad),
    iva: round2(iva),
    total: round2(cd + administration + imprevistos + utilidad + iva),
  };
}
