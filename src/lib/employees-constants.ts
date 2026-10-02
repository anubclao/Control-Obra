// Extraido de employees-store.ts (constantes + helpers)
import type { EmployeeDocumentType, EmployeeStatus } from "@/types";

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  ON_LEAVE: "En licencia",
  TERMINATED: "Terminado",
};

export const EMPLOYEE_STATUS_VARIANTS: Record<
  EmployeeStatus,
  "default" | "success" | "warning" | "destructive"
> = {
  ACTIVE: "success",
  INACTIVE: "default",
  ON_LEAVE: "warning",
  TERMINATED: "destructive",
};

export const EMPLOYEE_DEPARTMENT_LABELS: Record<string, string> = {
  GERENCIA: "Gerencia",
  OPERACIONES: "Operaciones",
  CONTABILIDAD: "Contabilidad",
  TESORERIA: "Tesorería",
  HSEQ: "HSEQ",
  COMERCIAL: "Comercial",
  ADMINISTRATIVO: "Administrativo",
};

export const EMPLOYEE_CONTRACT_LABELS: Record<string, string> = {
  INDEFINIDO: "Término indefinido",
  FIJO: "Término fijo",
  OBRA_LABOR: "Obra o labor",
  PRESTACION: "Prestación de servicios",
  APRENDIZAJE: "Aprendizaje",
};

export const EMPLOYEE_DOC_TYPE_LABELS: Record<EmployeeDocumentType, string> = {
  CEDULA: "Cédula",
  CONTRATO: "Contrato laboral",
  AFILIACION_EPS: "Afiliación EPS",
  AFILIACION_PENSION: "Afiliación Pensión",
  AFILIACION_ARL: "Afiliación ARL",
  EXAMEN_INGRESO: "Examen de ingreso",
  EXAMEN_PERIODICO: "Examen periódico",
  CERTIFICACION_ALTURAS: "Certificación trabajo en alturas",
  LICENCIA_CONDUCIR: "Licencia de conducir",
  CURSO_SST: "Curso SST",
  OTROS: "Otros",
};
