// filepath: src/lib/document-generator/registry.ts
// Resolución pura entity+record → templateId.
// Sin I/O, sin BD — recibe el record ya cargado y devuelve la plantilla.
// Mantener en sincronía con docs/specs/document-generation-sharepoint.md §2.1.

import type { DocumentEntity, DocumentTemplateId } from "@/types/documents";

/**
 * Códigos de error tipados que devuelve resolveTemplate().
 * Se propagan al API layer para responder con códigos 4xx/5xx coherentes.
 */
export type ResolveTemplateError =
  | { code: "TEMPLATE_MISSING"; entity: DocumentEntity }
  | {
      code: "TEMPLATE_MISMATCH";
      entity: DocumentEntity;
      expected: DocumentTemplateId[];
      got: string;
    };

export type ResolveTemplateResult =
  | { ok: true; templateId: DocumentTemplateId }
  | { ok: false; error: ResolveTemplateError };

/**
 * Record mínimos que necesita el registry para resolver.
 * Mantener la superficie chica: solo lo que distingue entre plantillas del
 * mismo entity (ej. para contracts, `pricingMode`).
 */
export interface ResolveInput {
  // payments
  type?: string;
  // expenses
  // (no distingue hoy entre OC/OS — ver SPEC §2.1 matriz)
  // contracts
  contractType?: string; // "OBRA" | "DISENOS" | "LABORAL"
  pricingMode?: string; // "UNIT_PRICE" | "LUMP_SUM" | "COST_PLUS"
  // workLogs
  workLogType?: string; // "AUSENCIA" | ...
}

/**
 * Tabla de resolución para contracts: pricingMode → templateId.
 * COST_PLUS no tiene plantilla oficial aún — devuelve TEMPLATE_MISMATCH.
 */
const CONTRACT_OBRA_MAP: Record<string, DocumentTemplateId> = {
  LUMP_SUM: "CONT_GLOBAL",
  UNIT_PRICE: "CONT_UNITARIO",
};

/**
 * Tabla de resolución para payments: type → templateId.
 * Solo los tipos que generan formato oficial. El resto no produce doc.
 */
const PAYMENT_TYPE_MAP: Record<string, DocumentTemplateId> = {
  ANTICIPO: "AD-0033",
};

/**
 * Tabla de resolución para expenses: type → templateId.
 * expense-form usa tipos como ORDEN_COMPRA_POLIZAS / ORDEN_SERVICIO_POLIZAS.
 */
const EXPENSE_TYPE_MAP: Record<string, DocumentTemplateId> = {
  ORDEN_COMPRA_POLIZAS: "OC",
  ORDEN_COMPRA_SIN_POLIZAS: "OC",
  ORDEN_SERVICIO_POLIZAS: "OS",
  ORDEN_SERVICIO_SIN_POLIZAS: "OS",
  SOLICITUD_RECURSO: "AD-0033", // asimilable a anticipo
  LEGALIZACION_GASTO: "LEG",
  SOLICITUD_REINTEGRO: "LEG",
};

const WORKLOG_TYPE_MAP: Record<string, DocumentTemplateId> = {
  AUSENCIA: "AUSENCIA",
};

/**
 * Resuelve qué plantilla usar para una entidad + su record.
 * Si la entidad no genera formato (ej. payment type=OTROS) devuelve
 * { ok: false, error: { code: "TEMPLATE_MISSING" } } — el caller decide
 * si responder 404 o continuar sin generar.
 */
export function resolveTemplate(
  entity: DocumentEntity,
  input: ResolveInput,
): ResolveTemplateResult {
  switch (entity) {
    case "payments": {
      if (!input.type) {
        return {
          ok: false,
          error: { code: "TEMPLATE_MISSING", entity },
        };
      }
      const tpl = PAYMENT_TYPE_MAP[input.type];
      if (!tpl) {
        return {
          ok: false,
          error: {
            code: "TEMPLATE_MISMATCH",
            entity,
            expected: Object.keys(PAYMENT_TYPE_MAP) as DocumentTemplateId[],
            got: input.type,
          },
        };
      }
      return { ok: true, templateId: tpl };
    }

    case "expenses": {
      if (!input.type) {
        return {
          ok: false,
          error: { code: "TEMPLATE_MISSING", entity },
        };
      }
      const tpl = EXPENSE_TYPE_MAP[input.type];
      if (!tpl) {
        return {
          ok: false,
          error: {
            code: "TEMPLATE_MISMATCH",
            entity,
            expected: Object.keys(EXPENSE_TYPE_MAP) as DocumentTemplateId[],
            got: input.type,
          },
        };
      }
      return { ok: true, templateId: tpl };
    }

    case "contracts": {
      if (input.contractType === "DISENOS") {
        return { ok: true, templateId: "CONT_DISENOS" };
      }
      if (input.contractType === "LABORAL") {
        return { ok: true, templateId: "CONT_LABORAL" };
      }
      if (input.contractType === "OBRA") {
        const tpl = input.pricingMode
          ? CONTRACT_OBRA_MAP[input.pricingMode]
          : undefined;
        if (!tpl) {
          return {
            ok: false,
            error: {
              code: "TEMPLATE_MISMATCH",
              entity,
              expected: Object.keys(CONTRACT_OBRA_MAP) as DocumentTemplateId[],
              got: input.pricingMode ?? "undefined",
            },
          };
        }
        return { ok: true, templateId: tpl };
      }
      return {
        ok: false,
        error: { code: "TEMPLATE_MISSING", entity },
      };
    }

    case "employees":
      // Un empleado genera contrato laboral siempre que se cree desde la app.
      return { ok: true, templateId: "CONT_LABORAL" };

    case "workLogs": {
      const tpl = input.workLogType
        ? WORKLOG_TYPE_MAP[input.workLogType]
        : "AUSENCIA";
      if (!tpl) {
        return {
          ok: false,
          error: {
            code: "TEMPLATE_MISMATCH",
            entity,
            expected: Object.keys(CONTRACT_OBRA_MAP) as DocumentTemplateId[],
            got: input.workLogType ?? "undefined",
          },
        };
      }
      return { ok: true, templateId: tpl };
    }

    case "cuts":
      // Un corte aprobado siempre genera el formato de corte.
      return { ok: true, templateId: "CORTE" };

    default: {
      // Exhaustividad
      const _exhaustive: never = entity;
      return {
        ok: false,
        error: { code: "TEMPLATE_MISSING", entity: _exhaustive },
      };
    }
  }
}

/**
 * Helper para usar en forms: dada la entidad, lista los `type` que SÍ generan
 * formato. Útil para mostrar/ocultar el botón "Generar documento".
 */
export function listGeneratableTypes(
  entity: DocumentEntity,
): readonly string[] {
  switch (entity) {
    case "payments":
      return Object.keys(PAYMENT_TYPE_MAP);
    case "expenses":
      return Object.keys(EXPENSE_TYPE_MAP);
    case "contracts":
      return ["OBRA", "DISENOS", "LABORAL"];
    case "workLogs":
      return Object.keys(WORKLOG_TYPE_MAP);
    case "employees":
      return []; // Siempre genera
    case "cuts":
      return []; // Siempre genera
  }
}
