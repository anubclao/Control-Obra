// Extraido de pscs-store.ts (constantes + helpers)
import type { PSCStatus } from "@/types";

export const PSC_STATUS_LABELS: Record<PSCStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

export const PSC_STATUS_VARIANTS: Record<
  PSCStatus,
  "default" | "success" | "warning" | "info" | "destructive"
> = {
  DRAFT: "default",
  ACTIVE: "success",
  SUSPENDED: "warning",
  COMPLETED: "info",
  CANCELLED: "destructive",
};
