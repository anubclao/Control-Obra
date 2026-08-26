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

export const CONTRACT_STATUS_VARIANTS: Record<ContractStatus, "default" | "success" | "warning" | "destructive" | "info"> = {
  DRAFT: "default",
  ACTIVE: "success",
  COMPLETED: "info",
  CANCELLED: "destructive",
  SUSPENDED: "warning",
};

export const CONTRACT_DOCUMENT_TYPE_LABELS: Record<ContractDocumentType, string> = {
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
