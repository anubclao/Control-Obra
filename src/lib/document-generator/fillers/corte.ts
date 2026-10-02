// filepath: src/lib/document-generator/fillers/corte.ts
// Filler para "3.7. FORMATO DE CORTE Y MEMORIAS DE OBRA.xlsx".
// Refactor F2: lee del row de `work_cuts` normalizado.
//
// Mapeo de celdas (verificado leyendo la plantilla real):
//   C2   OBRA                                  → context.project?.name ?? ""
//   H2   CORTE DE OBRA No.                     → row.cutNumber
//   H3   FECHA DE CORTE                        → context.today (serial Excel)
//   F4   CONTRATISTA                           → context.provider?.name ?? row.providerName
//   ──── Item 1 (fila 6) ────
//   B6   ITEM NRO                              → "1"
//   C6   DESCRIPCIÓN                           → row.description
//   E6   UNIDAD                                → "GLB"
//   F6   CANTIDAD                              → 1
//   G6   VR UNITARIO                           → row.grossValue
//   H6   VR TOTAL (fórmula)                    → se preserva
//   J6   CANTIDAD AVANCE                       → 1
//   K6   SUBTOTAL AVANCE (fórmula)             → se preserva
//   ──── Resumen financiero ────
//   H10/H11/H15 (fórmulas)                     → se preservan
//   G13  RETENCIÓN DE GARANTÍA                 → row.retentionPercent (en %)
//   G14  AMORTIZACIÓN ANTICIPO                 → row.advanceDeduction
//   H18  VALOR DEL ACTA                        → row.netValue
//   G19  ANTICIPO DEL 50 %                     → row.advanceDeduction
//   H26  TOTAL A PAGAR                         → row.netValue
//   A17  NOTA                                  → período facturado

import {
  readWorkbook,
  setVal,
  todayAsExcelSerial,
  writeWorkbook,
  getSheet,
} from "./xlsx-helpers";
import type { Filler } from "./types";
import type { CorteRow } from "./entity-data";

export const corteFiller: Filler = async ({ templateBytes, data, context }) => {
  const row = data as CorteRow;
  const wb = readWorkbook(templateBytes);
  const ws = getSheet(wb);

  // 1) Encabezado
  if (context.project) {
    setVal(ws, "C2", context.project.name);
  }
  setVal(ws, "H2", row.cutNumber);
  if (context.today) {
    setVal(ws, "H3", todayAsExcelSerial(context.today));
  }
  setVal(ws, "F4", context.provider?.name ?? row.providerName ?? "");

  // 2) Item principal (la plantilla estándar tiene 1 item "macro")
  setVal(ws, "B6", 1);
  setVal(ws, "C6", row.description);
  setVal(ws, "E6", "GLB");
  setVal(ws, "F6", 1);
  setVal(ws, "G6", row.grossValue);
  setVal(ws, "J6", 1);
  // H6 (VR TOTAL) y K6 (SUBTOTAL) son fórmulas — se preservan.

  // 3) Resumen financiero
  // La plantilla usa % en G13 (10 = 10%); el row trae decimal (0.10)
  const retencionPctDisplay =
    row.retentionPercent > 1
      ? row.retentionPercent
      : row.retentionPercent * 100;
  setVal(ws, "G13", retencionPctDisplay);
  setVal(ws, "G14", row.advanceDeduction);
  setVal(ws, "H18", row.netValue);
  setVal(ws, "G19", row.advanceDeduction);
  setVal(ws, "H26", row.netValue);
  // H10, H11, H15 son fórmulas — se preservan.

  // 4) Nota con período
  if (row.periodStart && row.periodEnd) {
    setVal(
      ws,
      "A17",
      `NOTA: Período facturado ${row.periodStart} → ${row.periodEnd}.`,
    );
  }

  return {
    content: writeWorkbook(wb),
    mimetype:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
};
