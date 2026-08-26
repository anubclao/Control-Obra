// Extraido de cuts-store.ts (constantes + helpers)
import type { ApprovalAction, WorkCutDocumentType, WorkCutStatus } from "@/types";

export const CUT_STATUS_LABELS: Record<WorkCutStatus, string> = {
  DRAFT: "Borrador",
  SUBMITTED: "Enviado",
  VALIDATED: "Validado",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  PAID: "Pagado",
};

export const CUT_STATUS_VARIANTS: Record<
  WorkCutStatus,
  "default" | "warning" | "info" | "success" | "destructive"
> = {
  DRAFT: "default",
  SUBMITTED: "warning",
  VALIDATED: "info",
  APPROVED: "success",
  REJECTED: "destructive",
  PAID: "success",
};

export const CUT_DOCUMENT_TYPE_LABELS: Record<WorkCutDocumentType, string> = {
  ACTA: "Acta",
  FACTURA: "Factura",
  SOPORTE: "Soporte",
  OTROS: "Otros",
};

export const ACTION_LABELS: Record<ApprovalAction, string> = {
  SUBMIT: "Enviado a validación",
  VALIDATE: "Validado",
  APPROVE: "Aprobado",
  REJECT: "Rechazado",
  PAY: "Pagado",
};

export const ACTION_BUTTONS: Record<WorkCutStatus, ApprovalAction[]> = {
  DRAFT: ["SUBMIT"],
  SUBMITTED: ["VALIDATE", "REJECT"],
  VALIDATED: ["APPROVE", "REJECT"],
  APPROVED: ["PAY"],
  REJECTED: ["SUBMIT"],
  PAID: [],
};
