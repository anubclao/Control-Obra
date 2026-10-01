// filepath: src/lib/document-generator/fillers/anticipo.ts
// Filler para "3.2. AD-0033- SOLICITUD DE ANTICIPO.xlsx".
//
// Refactor F2: lee directamente del row de `payment_requests` normalizado
// (camelCase). No requiere mapeo intermedio en el service.
//
// Mapeo de celdas (verificado leyendo la plantilla real — fila 1-indexada):
//   B6   FECHA                  → context.today
//   B7   NOMBRE                 → row.beneficiaryName (proveedor)
//   D7   C.C. / NIT             → row.beneficiaryNit
//   B8   CARGO                  → "CONTRATISTA / PROVEEDOR"
//   B9   CUENTA No              → row.bankName + " " + row.accountNumber
//   B10  FORMA PAGO TRANSFER.   → X si bankName presente
//   B11  A FAVOR DE             → row.beneficiaryName
//   B12  NIT                    → row.beneficiaryNit
//   B16-21 JUSTIFICACION        → row.description (multilínea)
//   B22  VALOR                  → row.amount
//   E22  EN LETRAS              → numeroALetrasCOP(row.amount)
//   H6   FECHA serial Excel     → todayAsExcelSerial(context.today)

import {
  numeroALetrasCOP,
  readWorkbook,
  setVal,
  todayAsExcelSerial,
  writeWorkbook,
  getSheet,
} from "./xlsx-helpers";
import type { Filler } from "./types";
import type { AnticipoRow } from "./entity-data";

export const anticipoFiller: Filler = async ({
  templateBytes,
  data,
  context,
}) => {
  const row = data as AnticipoRow;
  const wb = readWorkbook(templateBytes);
  const ws = getSheet(wb);

  // 1) Encabezado: fecha (texto + serial Excel)
  if (context.today) {
    setVal(ws, "B6", context.today);
    setVal(ws, "H6", todayAsExcelSerial(context.today));
  }

  // 2) Datos del beneficiario (la plantilla los repite en varias filas)
  setVal(ws, "B7", row.beneficiaryName);
  setVal(ws, "D7", row.beneficiaryNit);
  setVal(ws, "B8", "CONTRATISTA / PROVEEDOR");
  setVal(ws, "B11", row.beneficiaryName);
  setVal(ws, "B12", row.beneficiaryNit);

  // 3) Cuenta destino: "BANCO cuenta"
  const cuenta = [row.bankName, row.accountNumber].filter(Boolean).join(" ");
  if (cuenta) setVal(ws, "B9", cuenta);

  // 4) Forma de pago: TRANSFERENCIA por defecto si hay accountNumber
  if (row.accountNumber) setVal(ws, "E10", "X");

  // 5) Justificación (description) — partir en líneas si trae \n
  const desc = row.description ?? "";
  const lines = desc.split(/\r?\n/);
  setVal(ws, "B16", lines[0] ?? "");
  lines.slice(1, 6).forEach((line, i) => setVal(ws, `B${17 + i}`, line));

  // 6) Valor y letras
  setVal(ws, "B22", row.amount);
  setVal(ws, "E22", numeroALetrasCOP(row.amount));

  return {
    content: writeWorkbook(wb),
    mimetype:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
};
