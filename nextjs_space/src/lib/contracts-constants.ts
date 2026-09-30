// Extraido de contracts-store.ts (constantes + helpers)
import type { ContractDocumentType, ContractStatus } from "@/types";

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  OBRA: "Obra",
  SUMINISTRO: "Suministro",
  SERVICIOS: "Servicios",
  CONSULTORIA: "Consultoría",
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  SUSPENDED: "Suspendido",
};

export const CONTRACT_STATUS_VARIANTS: Record<
  ContractStatus,
  "default" | "success" | "warning" | "destructive" | "info"
> = {
  DRAFT: "default",
  ACTIVE: "success",
  COMPLETED: "info",
  CANCELLED: "destructive",
  SUSPENDED: "warning",
};

export const CONTRACT_DOCUMENT_TYPE_LABELS: Record<
  ContractDocumentType,
  string
> = {
  CONTRATO_FIRMADO: "Contrato firmado",
  POLIZA_CUMPLIMIENTO: "Póliza de cumplimiento",
  POLIZA_RESPONSABILIDAD: "Póliza de responsabilidad",
  POLIZA_ANTICIPO: "Póliza de anticipo",
  ACTA_INICIO: "Acta de inicio",
  OTROS: "Otros",
};

export const REQUIRED_CONTRACT_DOCS: ContractDocumentType[] = [
  "CONTRATO_FIRMADO",
  "POLIZA_CUMPLIMIENTO",
  "ACTA_INICIO",
];

// ---------------------------------------------------------------------------
// Modalidad de contratación (gap-analysis §3.3, PDF p.5 contrato 0000025-0703)
// ---------------------------------------------------------------------------

export const CONTRACT_PRICING_MODES = [
  "UNIT_PRICE",
  "LUMP_SUM",
  "COST_PLUS",
] as const;

export type ContractPricingMode = (typeof CONTRACT_PRICING_MODES)[number];

export const DEFAULT_PRICING_MODE: ContractPricingMode = "UNIT_PRICE";

export const CONTRACT_PRICING_MODE_LABELS: Record<ContractPricingMode, string> =
  {
    UNIT_PRICE: "Precios unitarios",
    LUMP_SUM: "Suma alzada (llave en mano)",
    COST_PLUS: "Administración delegada",
  };

export const CONTRACT_PRICING_MODE_DESCRIPTIONS: Record<
  ContractPricingMode,
  string
> = {
  UNIT_PRICE:
    "Se cobra por cantidades ejecutadas a precio unitario preestablecido (caso del contrato 0000025-0703).",
  LUMP_SUM:
    "Precio global fijo; el contratista asume el riesgo de las cantidades (todo costo / llave en mano).",
  COST_PLUS:
    "Pago por honorarios del contratista más reembolso de los costos directos de la obra.",
};

/** Etiqueta en español para mostrar en UI. */
export function pricingModeLabel(mode: ContractPricingMode): string {
  return CONTRACT_PRICING_MODE_LABELS[mode];
}

/** Descripción larga en español para tooltip / ayuda. */
export function pricingModeDescription(mode: ContractPricingMode): string {
  return CONTRACT_PRICING_MODE_DESCRIPTIONS[mode];
}

/** Type guard: ¿es un valor válido de la unión? */
export function isPricingMode(v: unknown): v is ContractPricingMode {
  return (
    typeof v === "string" &&
    (CONTRACT_PRICING_MODES as readonly string[]).includes(v)
  );
}

/**
 * Normaliza la entrada al modelo: null/undefined/'' → default (UNIT_PRICE).
 * Valor válido → se devuelve tal cual. Valor inválido → devuelve default.
 * (Para validación estricta con error, usar `validatePricingMode`.)
 */
export function normalizePricingMode(
  v: string | null | undefined,
): ContractPricingMode {
  if (isPricingMode(v)) return v;
  return DEFAULT_PRICING_MODE;
}

// ---------------------------------------------------------------------------
// Validación estricta (para la API: rechaza valores fuera de la unión)
// ---------------------------------------------------------------------------

export type ContractPricingModeErrorCode = "PRICING_MODE_INVALID";

export type ContractPricingModeResult =
  | {
      ok: true;
      value: ContractPricingMode;
      code?: undefined;
      error?: undefined;
      status?: undefined;
    }
  | {
      ok: false;
      value?: undefined;
      code: ContractPricingModeErrorCode;
      error: string;
      status: 400;
    };

export function validatePricingMode(v: unknown): ContractPricingModeResult {
  if (v == null || v === "") {
    return { ok: true, value: DEFAULT_PRICING_MODE };
  }
  if (isPricingMode(v)) {
    return { ok: true, value: v };
  }
  return {
    ok: false,
    code: "PRICING_MODE_INVALID",
    error: `Modalidad de contratación inválida. Valores permitidos: ${CONTRACT_PRICING_MODES.join(", ")}`,
    status: 400,
  };
}
