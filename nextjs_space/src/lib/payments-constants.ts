// Extraido de payments-store.ts (constantes + helpers)
import type { PaymentAction, PaymentStatus } from "@/types";

/**
 * P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.3):
 *   Las constantes y helpers de ACCION de pagos viven en
 *   `payments-workflow.ts` (la fuente unica de verdad del flujo). Aqui
 *   solo dejamos los labels de estado/tipo/prioridad (que son de
 *   presentacion) y re-exportamos `PAYMENT_ACTION_LABELS`,
 *   `PAYMENT_ACTION_ROLES` y `getAvailablePaymentActions` para
 *   mantener compatibilidad con los imports existentes.
 */
export {
  PAYMENT_ACTION_LABELS,
  PAYMENT_ACTION_ROLES,
  getAvailablePaymentActions,
  type PaymentActionButton,
} from "./payments-workflow";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pendiente",
  APPROVED_LEVEL_1: "Aprobado N1",
  APPROVED_LEVEL_2: "Aprobado N2",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  PAID: "Pagado",
  CANCELLED: "Cancelado",
};

export const PAYMENT_STATUS_VARIANTS: Record<
  PaymentStatus,
  "default" | "warning" | "info" | "success" | "destructive"
> = {
  PENDING: "warning",
  APPROVED_LEVEL_1: "info",
  APPROVED_LEVEL_2: "info",
  APPROVED: "success",
  REJECTED: "destructive",
  PAID: "success",
  CANCELLED: "default",
};

export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  CORTE_OBRA: "Corte de obra",
  ANTICIPO: "Anticipo",
  RETENCION: "Retención",
  SUMINISTRO: "Suministro",
  SERVICIOS: "Servicios",
  HONORARIOS: "Honorarios",
  OTROS: "Otros",
};

export const PAYMENT_PRIORITY_LABELS: Record<string, string> = {
  LOW: "Baja",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export const PAYMENT_PRIORITY_VARIANTS: Record<
  string,
  "default" | "info" | "warning" | "destructive"
> = {
  LOW: "default",
  NORMAL: "info",
  HIGH: "warning",
  URGENT: "destructive",
};
