/**
 * lib/taxes-fetcher.ts
 *
 * Carga y cache de la configuracion de impuestos para uso cliente.
 *
 * P2 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.3):
 *   Antes el dashboard administrativo hardcodeaba 10% retencion y
 *   19% IVA en la pagina (`administrativo/page.tsx:69-70`). Eso
 *   contradice al modulo de Impuestos. Aqui centralizamos:
 *     - `getTaxRate(taxes, type, appliesTo?)` busca el primer tax
 *       activo del tipo pedido.
 *     - `resolveTaxRates(taxes)` devuelve {retention, iva} con los
 *       rates efectivos para el dashboard. Si no hay tax activo,
 *       devuelve los defaults (0.1 / 0.19) con un flag `usingDefaults`
 *       para que la UI pueda avisar al usuario.
 *   Esta capa es PURA (sin fetch, sin estado): el caller le pasa
 *   el array de taxes. Asi se puede testear sin red.
 */

import type { TaxConfig, TaxType, TaxAppliesTo } from "@/types";

/** Rates por defecto que el sistema usaba antes de este modulo. */
export const DEFAULT_RETENTION_RATE = 0.1;
export const DEFAULT_IVA_RATE = 0.19;

export interface ResolvedTaxRates {
  retention: number;
  iva: number;
  /** True si algun rate se tomo del default por falta de config. */
  usingDefaults: { retention: boolean; iva: boolean };
}

/**
 * Devuelve la tasa del primer impuesto activo que coincida con `type`
 * y, si se pasa, con `appliesTo`. Si no encuentra, devuelve undefined.
 */
export function getTaxRate(
  taxes: TaxConfig[] | undefined | null,
  type: TaxType,
  appliesTo?: TaxAppliesTo,
): number | undefined {
  if (!taxes || taxes.length === 0) return undefined;
  const match = taxes.find(
    (t) =>
      t.isActive &&
      t.type === type &&
      (!appliesTo || t.appliesTo === appliesTo || t.appliesTo === "AMBOS"),
  );
  return match?.rate;
}

/**
 * Resuelve los rates efectivos para los KPIs del dashboard.
 *
 * Orden de busqueda:
 *   - Retencion: primero RETENCION_FUENTE, luego RETENCION_ICA,
 *     luego RETENCION_IVA. Asi el admin puede nombrarlos como quiera
 *     y el primero activo gana.
 *   - IVA: solo el tipo IVA.
 *
 * Si no hay config activa, cae a los defaults (0.1 / 0.19) y marca
 * `usingDefaults` para que la UI muestre un aviso.
 */
export function resolveTaxRates(
  taxes: TaxConfig[] | undefined | null,
): ResolvedTaxRates {
  if (!taxes) taxes = [];
  const retention =
    getTaxRate(taxes, "RETENCION_FUENTE") ??
    getTaxRate(taxes, "RETENCION_ICA") ??
    getTaxRate(taxes, "RETENCION_IVA");
  const iva = getTaxRate(taxes, "IVA");
  return {
    retention: retention ?? DEFAULT_RETENTION_RATE,
    iva: iva ?? DEFAULT_IVA_RATE,
    usingDefaults: {
      retention: retention == null,
      iva: iva == null,
    },
  };
}
