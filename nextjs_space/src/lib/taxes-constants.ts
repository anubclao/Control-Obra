// Extraido de taxes-store.ts (constantes + helpers)
import type { TaxAppliesTo, TaxType } from "@/types";

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  IVA: "IVA",
  RETENCION_FUENTE: "Retención en la Fuente",
  RETENCION_IVA: "Retención de IVA",
  RETENCION_ICA: "Retención de ICA",
  ESTAMPILLAS: "Estampillas",
  OTROS: "Otros",
};

export const TAX_APPLIES_LABELS: Record<TaxAppliesTo, string> = {
  VENTAS: "Solo ventas",
  COMPRAS: "Solo compras",
  AMBOS: "Ventas y compras",
};
