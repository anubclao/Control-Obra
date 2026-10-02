// Extraido de quotations-store.ts (constantes + helpers)
import type { QuotationStatus } from "@/types";

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  VIEWED: "Vista",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  EXPIRED: "Vencida",
  CANCELLED: "Cancelada",
};

export const QUOTATION_STATUS_VARIANTS: Record<
  QuotationStatus,
  "default" | "info" | "warning" | "success" | "destructive"
> = {
  DRAFT: "default",
  SENT: "info",
  VIEWED: "info",
  ACCEPTED: "success",
  REJECTED: "destructive",
  EXPIRED: "warning",
  CANCELLED: "default",
};
