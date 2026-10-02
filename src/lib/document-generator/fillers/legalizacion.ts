// filepath: src/lib/document-generator/fillers/legalizacion.ts
// Filler para "3.3. FORMATO DE LEGALIZACIÓN O REINTEGRO.xlsx".
//
// Refactor F2: lee del row de `payment_requests` con type='LEGALIZACION'.
//
// Mapeo de celdas (verificado leyendo la plantilla real):
//   B2   FECHA                              → context.today
//   F2   TÍTULO                             → "LEGALIZACIÓN DE GASTOS" / "REINTEGRO"
//   B3   NOMBRE FUNCIONARIO                 → context.provider?.name ?? ""
//   F3   CARGO                              → "RESIDENTE DE OBRA"
//   B4   EMPRESA                            → context.project?.client ?? ""
//   ──── Items (filas 7-15) ────
//   A7-15 FECHA item                        → context.today
//   B7-15 PROVEEDOR                         → row.beneficiaryName (1 sola línea)
//   C7-15 CC/NIT                            → row.beneficiaryNit
//   D7-15 CENTRO DE COSTO                   → context.project?.code ?? ""
//   E7-15 DESCRIPCIÓN DEL GASTO             → row.description
//   F7-15 VALOR UNITARIO                    → row.amount
//   G7-15 IVA 19%                           → 0 (por defecto exento)
//   H7-15 SUBTOTAL (fórmula =F+G)           → se preserva
//   I7-15 PAGO CON TARJETA                  → "NO"
//   F16/G16/H16 SUM (fórmulas)              → se preservan
//
// Notas:
//   - La plantilla tiene 9 filas para items (7-15). La fila real de un
//     payment de legalización contiene 1 solo gasto, así que usamos fila 7.
//   - Las celdas con fórmula (H7-H15, F16, G16, H16) NO se tocan.

import {
  readWorkbook,
  setVal,
  todayAsExcelSerial,
  writeWorkbook,
  getSheet,
} from "./xlsx-helpers";
import type { Filler } from "./types";
import type { LegalizacionRow } from "./entity-data";

export const legalizacionFiller: Filler = async ({
  templateBytes,
  data,
  context,
}) => {
  const row = data as LegalizacionRow;
  const wb = readWorkbook(templateBytes);
  const ws = getSheet(wb);

  // 1) Encabezado
  if (context.today) {
    setVal(ws, "B2", context.today);
    setVal(ws, "A7", todayAsExcelSerial(context.today));
  }
  setVal(ws, "F2", "LEGALIZACIÓN DE GASTOS");

  // 2) Datos del funcionario (provider o fallback)
  setVal(ws, "B3", context.provider?.name ?? "—");
  setVal(ws, "F3", "RESIDENTE DE OBRA");
  setVal(ws, "B4", context.project?.client ?? "—");

  // 3) Item único (fila 7): el row de payment es 1 solo gasto
  setVal(ws, "B7", row.beneficiaryName);
  setVal(ws, "C7", row.beneficiaryNit);
  setVal(ws, "D7", context.project?.code ?? "");
  setVal(ws, "E7", row.description ?? "—");
  setVal(ws, "F7", row.amount);
  setVal(ws, "G7", 0); // exento por defecto
  setVal(ws, "I7", "NO");
  // H7 (subtotal), F16/G16/H16 (totales) son fórmulas — se preservan.

  // 4) Nota al pie con resumen
  setVal(
    ws,
    "A17",
    `NOTA 01: Legalización por $${row.amount.toLocaleString("es-CO")} — ` +
      `Beneficiario: ${row.beneficiaryName} (${row.beneficiaryNit}).`,
  );

  return {
    content: writeWorkbook(wb),
    mimetype:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
};
