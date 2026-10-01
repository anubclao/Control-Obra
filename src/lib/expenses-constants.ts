// Extraido de expenses-store.ts (constantes + helpers)
import type { ExpenseStatus, ExpenseType } from "@/types";

export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  CONTRATO_OBRA_CIVIL_POLIZAS: "Contrato obra civil (con pólizas)",
  CONTRATO_OBRA_CIVIL_SIN_POLIZAS: "Contrato obra civil (sin pólizas)",
  PRESTACION_SERVICIOS: "Prestación de servicios",
  LABORAL_OBRA: "Laboral por obra",
  LABORAL_TERMINO_INDEFINIDO: "Laboral término indefinido",
  LABORAL_TERMINO_DEFINIDO: "Laboral término definido",
  ORDEN_SERVICIO_POLIZAS: "Orden de servicio (con pólizas)",
  ORDEN_SERVICIO_SIN_POLIZAS: "Orden de servicio (sin pólizas)",
  ORDEN_COMPRA_POLIZAS: "Orden de compra (con pólizas)",
  ORDEN_COMPRA_SIN_POLIZAS: "Orden de compra (sin pólizas)",
  SOLICITUD_RECURSO: "Solicitud de recursos (viáticos, caja menor, compras)",
  SOLICITUD_REINTEGRO: "Solicitud de reintegro",
  LEGALIZACION_GASTO: "Legalización de gastos",
};

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  DRAFT: "Borrador",
  PENDING_APPROVAL: "Pendiente aprobación",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  PAID: "Pagado",
};

export const EXPENSE_STATUS_VARIANTS: Record<ExpenseStatus, "default" | "warning" | "success" | "destructive" | "info"> = {
  DRAFT: "default",
  PENDING_APPROVAL: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  PAID: "info",
};

// Helper para agrupar gastos en UI por categoria
export type ExpenseCategory = "contrato" | "orden_servicio" | "orden_compra" | "laboral" | "recurso";

const EXPENSE_CONTRACT_TYPES = ["CONTRATO_OBRA_CIVIL_POLIZAS", "CONTRATO_OBRA_CIVIL_SIN_POLIZAS"];
const EXPENSE_SERVICE_ORDER_TYPES = ["ORDEN_SERVICIO_POLIZAS", "ORDEN_SERVICIO_SIN_POLIZAS"];
const EXPENSE_PURCHASE_ORDER_TYPES = ["ORDEN_COMPRA_POLIZAS", "ORDEN_COMPRA_SIN_POLIZAS"];
const EXPENSE_LABOR_TYPES = ["LABORAL_OBRA", "LABORAL_TERMINO_INDEFINIDO", "LABORAL_TERMINO_DEFINIDO"];

export function categoryFor(type: string): ExpenseCategory {
  if ((EXPENSE_CONTRACT_TYPES as string[]).includes(type)) return "contrato";
  if ((EXPENSE_SERVICE_ORDER_TYPES as string[]).includes(type)) return "orden_servicio";
  if ((EXPENSE_PURCHASE_ORDER_TYPES as string[]).includes(type)) return "orden_compra";
  if ((EXPENSE_LABOR_TYPES as string[]).includes(type)) return "laboral";
  return "recurso";
}
