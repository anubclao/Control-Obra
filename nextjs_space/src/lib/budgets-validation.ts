/**
 * lib/budgets-validation.ts
 *
 * Reglas de validación del módulo PRESUPUESTOS — funciones puras, sin BD ni React.
 *
 * Cubre las "Condiciones comerciales" del PT que el cliente quiere capturar
 * (gap-analysis §3.1) sin tocar los workflows ni romper los datos viejos:
 *   - Forma de pago (anticipo + cortes + contra entrega) → suma 100
 *   - Días de entrega / validez de oferta
 *   - Asesor comercial (opcional)
 *
 * La ruta /api/budgets importa estos helpers; la UI solo los usa para
 * deshabilitar botones y mostrar feedback. Ver la nota de narrowing en
 * lib/cuts-workflow.ts sobre el tsconfig (strictNullChecks: false).
 *
 * SPEC: docs/specs/gap-analysis-cliente-control-cambios.md §3.1
 */

// -----------------------------------------------------------------------------
// Tipos públicos (alineados con el shape JSON que se persiste en `budgets`)
// -----------------------------------------------------------------------------

export interface PaymentTermsInput {
  anticipoPct: number;
  cortesPct: number;
  contraEntregaPct: number;
}

export interface CommercialAdvisorInput {
  name: string;
  role: string;
  phone: string;
  email: string;
}

export interface BudgetCommercialTermsInput {
  paymentTerms?: PaymentTermsInput | null;
  deliveryDays?: number | null;
  offerValidityDays?: number | null;
  commercialAdvisor?: CommercialAdvisorInput | null;
}

// -----------------------------------------------------------------------------
// Códigos de error (unión literal para que la UI no aserte sobre texto)
// -----------------------------------------------------------------------------

export type BudgetCommercialErrorCode =
  | "PAYMENT_TERMS_NOT_100"
  | "PAYMENT_TERMS_OUT_OF_RANGE"
  | "DELIVERY_DAYS_INVALID"
  | "OFFER_VALIDITY_DAYS_INVALID"
  | "ADVISOR_EMAIL_INVALID"
  | "ADVISOR_REQUIRED_FIELDS";

export type BudgetCommercialResult =
  | { ok: true; code?: undefined; error?: undefined; status?: undefined }
  | {
      ok: false;
      code: BudgetCommercialErrorCode;
      error: string;
      status: 400;
    };

const TOLERANCE = 0.01; // admite 33.33/33.33/33.34 → 100.00

// -----------------------------------------------------------------------------
// Payment terms
// -----------------------------------------------------------------------------

export function isPaymentTermsComplete(
  pt: PaymentTermsInput | null | undefined,
): pt is PaymentTermsInput {
  if (!pt) return false;
  return (
    typeof pt.anticipoPct === "number" &&
    typeof pt.cortesPct === "number" &&
    typeof pt.contraEntregaPct === "number"
  );
}

function inRange(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

export function validatePaymentTerms(
  pt: PaymentTermsInput,
): BudgetCommercialResult {
  if (
    !inRange(pt.anticipoPct) ||
    !inRange(pt.cortesPct) ||
    !inRange(pt.contraEntregaPct)
  ) {
    return {
      ok: false,
      code: "PAYMENT_TERMS_OUT_OF_RANGE",
      error: "Cada porcentaje de la forma de pago debe estar entre 0 y 100",
      status: 400,
    };
  }
  const sum = pt.anticipoPct + pt.cortesPct + pt.contraEntregaPct;
  if (Math.abs(sum - 100) > TOLERANCE) {
    return {
      ok: false,
      code: "PAYMENT_TERMS_NOT_100",
      error: `La forma de pago debe sumar 100% (actual: ${sum.toFixed(2)}%)`,
      status: 400,
    };
  }
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Asesor comercial
// -----------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCommercialAdvisor(
  a: CommercialAdvisorInput,
): BudgetCommercialResult {
  if (!a.name?.trim() || !a.role?.trim() || !a.phone?.trim()) {
    return {
      ok: false,
      code: "ADVISOR_REQUIRED_FIELDS",
      error: "Asesor: nombre, cargo y teléfono son obligatorios",
      status: 400,
    };
  }
  if (!a.email?.trim() || !EMAIL_RE.test(a.email.trim())) {
    return {
      ok: false,
      code: "ADVISOR_EMAIL_INVALID",
      error: "Asesor: email inválido",
      status: 400,
    };
  }
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Bloque completo (todo opcional — backwards-compat con budgets viejos)
// -----------------------------------------------------------------------------

export function validateBudgetCommercialTerms(
  t: BudgetCommercialTermsInput | null | undefined,
): BudgetCommercialResult {
  // Budgets viejos: bloque ausente → no se rompe nada.
  if (!t) return { ok: true };

  if (isPaymentTermsComplete(t.paymentTerms)) {
    const r = validatePaymentTerms(t.paymentTerms);
    if (!r.ok) return r;
  }

  if (t.deliveryDays != null) {
    if (
      !Number.isFinite(t.deliveryDays) ||
      t.deliveryDays < 0 ||
      !Number.isInteger(t.deliveryDays)
    ) {
      return {
        ok: false,
        code: "DELIVERY_DAYS_INVALID",
        error: "Días de entrega debe ser un entero ≥ 0",
        status: 400,
      };
    }
  }

  if (t.offerValidityDays != null) {
    if (
      !Number.isFinite(t.offerValidityDays) ||
      t.offerValidityDays < 0 ||
      !Number.isInteger(t.offerValidityDays)
    ) {
      return {
        ok: false,
        code: "OFFER_VALIDITY_DAYS_INVALID",
        error: "Validez de la oferta debe ser un entero ≥ 0",
        status: 400,
      };
    }
  }

  if (t.commercialAdvisor) {
    const r = validateCommercialAdvisor(t.commercialAdvisor);
    if (!r.ok) return r;
  }

  return { ok: true };
}
