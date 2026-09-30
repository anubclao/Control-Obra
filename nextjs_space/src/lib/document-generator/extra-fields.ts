// filepath: src/lib/document-generator/extra-fields.ts
// Esquemas Zod para los campos EXTRA que cada plantilla necesita del form,
// más allá de los que ya están en la entidad base.
//
// Patrón (ver spec §4.2 + chat sobre "Patrón 3 form-driven"):
//   baseSchema.extend({ ...EXTRA_FIELDS.<template>.shape })
//
// Estos campos se validan en el form ANTES de submit, viajan en el payload
// y llegan al filler para renderizar la plantilla.

import { z } from "zod";
import type { DocumentTemplateId } from "@/types/documents";

/**
 * Campos extra para la plantilla AD-0033 (Solicitud de Anticipo).
 * Datos: a qué se destina el anticipo y plazo de amortización.
 */
export const AD_0033_EXTRA = z.object({
  itemAPagar: z.string().min(5, "Describe el ítem a pagar (mín. 5 letras)"),
  plazoAmortizacionDias: z.coerce
    .number()
    .int("Debe ser un entero de días")
    .min(1)
    .max(365),
});

/**
 * Campos extra para la plantilla LEG (Legalización / Reintegro).
 * Datos: anticipo que se legaliza, saldo resultante, número de facturas.
 */
export const LEG_EXTRA = z.object({
  anticipoRelacionadoId: z.string().min(1, "Selecciona el anticipo"),
  saldoAFavor: z.coerce.number(), // positivo = a favor; negativo = en contra
  numeroFacturas: z.coerce.number().int().min(1),
});

/**
 * Ítem de la OC / OS.
 * Compartido por OC_EXTRA y OS_EXTRA (mismo shape, distinto template).
 */
const OC_ITEM = z.object({
  descripcion: z.string().min(2),
  cantidad: z.coerce.number().min(0.001),
  unidad: z.string().min(1), // "UND", "M3", "KG", "M2"...
  valorUnitario: z.coerce.number().min(0),
});

/**
 * Campos extra para la plantilla OC (Orden de Compra).
 */
export const OC_EXTRA = z.object({
  items: z.array(OC_ITEM).min(1, "Agrega al menos un ítem"),
  condicionPago: z.enum(["CONTADO", "CREDITO_30", "CREDITO_60", "CREDITO_90"]),
  lugarEntrega: z.string().min(2, "Indica el lugar de entrega"),
});

/**
 * Campos extra para la plantilla OS (Orden de Servicio).
 * Similar a OC pero con "alcance" en vez de "ítems" — sin embargo, por
 * compatibilidad con el expense-form existente, reutilizamos `items` como
 * descripción de actividades. Si en el futuro el formato pide otra cosa,
 * se divide en OS_EXTRA_ACTIVIDADES.
 */
export const OS_EXTRA = z.object({
  items: z.array(OC_ITEM).min(1, "Agrega al menos una actividad"),
  condicionPago: z.enum(["CONTADO", "CREDITO_30", "CREDITO_60", "CREDITO_90"]),
  lugarEntrega: z.string().min(2, "Indica el lugar de ejecución"),
});

/**
 * Campos extra para CORTE (Corte y Memorias de Obra).
 * Período facturado y avance % se derivan del corte ya guardado, así que
 * no se piden al usuario en el form.
 */
export const CORTE_EXTRA = z.object({
  periodoFacturado: z.string().min(7), // "2026-09"
  observaciones: z.string().optional(),
});

/**
 * Campos extra para AUSENCIA (Ausencia Laboral).
 */
export const AUSENCIA_EXTRA = z.object({
  fechaInicio: z.string().min(10), // ISO date
  fechaFin: z.string().min(10), // ISO date
  motivo: z.enum([
    "ENFERMEDAD",
    "CALAMIDAD",
    "PERMISO_REMUNERADO",
    "PERMISO_NO_REMUNERADO",
    "VACACIONES",
    "OTRO",
  ]),
  descripcionMotivo: z.string().optional(),
});

/**
 * Campos extra para CONT_GLOBAL (Contrato a Precio Global).
 */
export const CONT_GLOBAL_EXTRA = z.object({
  valorGlobal: z.coerce.number().min(1, "El valor global debe ser > 0"),
  plazoMeses: z.coerce.number().int().min(1).max(120),
  objetoContractual: z.string().min(10),
});

/**
 * Campos extra para CONT_UNITARIO (Contrato a Precio Unitario).
 */
export const CONT_UNITARIO_EXTRA = z.object({
  plazoMeses: z.coerce.number().int().min(1).max(120),
  objetoContractual: z.string().min(10),
  items: z.array(OC_ITEM).min(1, "Agrega al menos un APU"),
});

/**
 * Campos extra para CONT_DISENOS (Contrato de Diseños).
 */
export const CONT_DISENOS_EXTRA = z.object({
  honorarios: z.coerce.number().min(1),
  plazoMeses: z.coerce.number().int().min(1).max(60),
  entregables: z.string().min(5),
});

/**
 * Campos extra para CONT_LABORAL (Contrato Laboral a Término Indefinido).
 */
export const CONT_LABORAL_EXTRA = z.object({
  cargo: z.string().min(2),
  salario: z.coerce.number().min(1),
  fechaInicio: z.string().min(10),
  tipoContrato: z.literal("INDEFINIDO"),
});

/**
 * Mapa de schemas por templateId.
 * El type `ExtraFieldsMap[K]` permite al form inferir el tipo con:
 *   type OcExtra = z.infer<typeof EXTRA_FIELDS.OC>;
 */
export const EXTRA_FIELDS = {
  "AD-0033": AD_0033_EXTRA,
  LEG: LEG_EXTRA,
  OC: OC_EXTRA,
  OS: OS_EXTRA,
  CORTE: CORTE_EXTRA,
  AUSENCIA: AUSENCIA_EXTRA,
  CONT_GLOBAL: CONT_GLOBAL_EXTRA,
  CONT_UNITARIO: CONT_UNITARIO_EXTRA,
  CONT_DISENOS: CONT_DISENOS_EXTRA,
  CONT_LABORAL: CONT_LABORAL_EXTRA,
} as const satisfies Record<DocumentTemplateId, z.ZodTypeAny>;

/**
 * Helper: lista los nombres de campos extra de un template (ordenados).
 * Útil para mensajes de error tipo "faltan: itemAPagar, plazoAmortizacionDias".
 */
export function listExtraFieldNames(
  templateId: DocumentTemplateId,
): readonly string[] {
  const schema = EXTRA_FIELDS[templateId];
  // z.ZodTypeAny no expone `.shape` de forma tipada; usamos Object.keys.
  // Cast seguro: las schemas aquí son todas z.object.
  const shape = (schema as unknown as { shape: Record<string, unknown> }).shape;
  return Object.keys(shape);
}
