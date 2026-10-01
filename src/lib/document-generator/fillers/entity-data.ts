// filepath: src/lib/document-generator/fillers/entity-data.ts
// Shapes de input que cada filler espera. Refactor F2: en lugar de un mapeo
// row→form intermedio en el service, los fillers leen directamente los
// campos del row normalizado (camelCase, igual que produce `normalizeEntity`).
//
// Mantener en sincronía con:
//   - docs/specs/document-generation-sharepoint.md §2.1
//   - schema real de la BD (database/mysql/init.sql, init.sql + 006)

import type { DocumentTemplateId } from "@/types/documents";

/** Provider/proveedor lookup (de la tabla `providers`). */
export interface ProviderView {
  name: string;
  nit: string;
  email?: string;
  phone?: string;
  address?: string;
}

/** Project lookup (de la tabla `projects`). */
export interface ProjectView {
  code: string;
  name: string;
  client: string;
  location: string;
}

/** Contexto que el dispatcher pasa a cada filler. */
export interface FillerRuntimeContext {
  project: ProjectView;
  provider?: ProviderView;
  today: string; // YYYY-MM-DD (local)
}

// ────────────────────────────────────────────────────────────────────
// Discriminated union: un row normalizado por templateId
// ────────────────────────────────────────────────────────────────────

/** AD-0033 — anticipo (payments con type='ANTICIPO'). */
export interface AnticipoRow {
  type: "ANTICIPO";
  amount: number;
  beneficiaryName: string;
  beneficiaryNit: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  description?: string;
  dueDate?: string;
  requestNumber?: string;
}

/** LEG — legalización (payments con type='LEGALIZACION'). */
export interface LegalizacionRow {
  type: "LEGALIZACION";
  amount: number;
  beneficiaryName: string;
  beneficiaryNit: string;
  bankName: string;
  accountNumber: string;
  description?: string;
  // items[] y campos relacionados se infieren del description o son opcionales
}

/** OC — orden de compra (expenses con type que empieza ORDEN_COMPRA_*). */
export interface OcRow {
  type: "ORDEN_COMPRA_POLIZAS" | "ORDEN_COMPRA_SIN_POLIZAS";
  expenseNumber: string;
  description: string;
  amount: number;
  hasPolizas?: boolean;
  cotizacionAprobada?: boolean;
  // Items derivados: la plantilla OC estándar tiene 1 línea. Múltiples se
  // concatenan con ", " en la descripción.
}

/** OS — orden de servicio (expenses con type que empieza ORDEN_SERVICIO_*). */
export interface OsRow {
  type: "ORDEN_SERVICIO_POLIZAS" | "ORDEN_SERVICIO_SIN_POLIZAS";
  expenseNumber: string;
  description: string;
  amount: number;
  hasPolizas?: boolean;
  cotizacionAprobada?: boolean;
}

/** CORTE — corte de obra (work_cuts). */
export interface CorteRow {
  cutNumber: string;
  description: string;
  grossValue: number;
  retentionPercent: number;
  retentionValue: number;
  advanceDeduction: number;
  netValue: number;
  periodStart: string;
  periodEnd: string;
  providerName: string; // viene de providerId → lookup
}

/** AUSENCIA — work_logs con tipo AUSENCIA. Stub (no implementado en F2). */
export interface AusenciaRow {
  type: "AUSENCIA";
  date: string;
  // El template es un PDF escaneado: no se puede rellenar automáticamente.
}

/** Contrato de OBRA (precios global). */
export interface ContratoObraRow {
  type: "OBRA";
  pricingMode: "LUMP_SUM" | "UNIT_PRICE";
  contractNumber: string;
  value: number;
  startDate: string;
  endDate: string;
  scopeOfWork: string;
  notes?: string;
  providerName: string;
  providerNit: string;
}

/** Contrato de DISEÑOS. */
export interface ContratoDisenosRow {
  type: "DISENOS";
  contractNumber: string;
  value: number;
  startDate: string;
  endDate: string;
  scopeOfWork: string;
  providerName: string;
  providerNit: string;
}

/** Contrato LABORAL (employees). */
export interface ContratoLaboralRow {
  employeeNumber: string;
  fullName: string;
  documentId: string;
  position: string;
  startDate: string;
  salary?: number;
  bankName?: string;
  accountType?: string;
  accountNumber?: string;
  eps?: string;
  pensionFund?: string;
  arl?: string;
}

/** Union: cualquier row que un filler puede consumir. */
export type EntityRow =
  | AnticipoRow
  | LegalizacionRow
  | OcRow
  | OsRow
  | CorteRow
  | AusenciaRow
  | ContratoObraRow
  | ContratoDisenosRow
  | ContratoLaboralRow;

/** Mapa templateId → tipo de row esperado. */
export type EntityRowFor<T extends DocumentTemplateId> = T extends "AD-0033"
  ? AnticipoRow
  : T extends "LEG"
    ? LegalizacionRow
    : T extends "OC"
      ? OcRow
      : T extends "OS"
        ? OsRow
        : T extends "CORTE"
          ? CorteRow
          : T extends "AUSENCIA"
            ? AusenciaRow
            : T extends "CONT_GLOBAL" | "CONT_UNITARIO"
              ? ContratoObraRow
              : T extends "CONT_DISENOS"
                ? ContratoDisenosRow
                : T extends "CONT_LABORAL"
                  ? ContratoLaboralRow
                  : EntityRow;
