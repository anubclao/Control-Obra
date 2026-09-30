// filepath: src/lib/document-generator/fillers/os.ts
// Filler para "3.6. FORMATO OS_ ORDEN DE SERVICIO.xlsx".
// Refactor F2: lee del row de `expenses` con type ORDEN_SERVICIO_*.
//
// Mapeo de celdas (verificado leyendo la plantilla real):
//   C6   FECHA                          → context.today
//   AC6  FECHA (serial Excel)           → todayAsExcelSerial(context.today)
//   I6   COT.No.                        → row.expenseNumber
//   C7   COMPRADOR                      → context.project?.client ?? "MARZO TRIANGULAR S.A.S"
//   I7   NIT (comprador)                → "830055571-1"
//   C8   DIRECCION DESPACHO             → context.project?.location ?? ""
//   I8   CONTACTO                       → context.provider?.name ?? ""
//   C9   OBRA                           → context.project?.name ?? ""
//   I9   TELEFONO                       → context.provider?.phone ?? ""
//   C10  PROVEEDOR                      → context.provider?.name ?? ""
//   C11  IDENTIFICACION                 → context.provider?.nit ?? ""
//   I11  TIPO                           → "NIT"
//   C13  TELEFONO                       → context.provider?.phone ?? ""
//   ──── Item (fila 19) ────
//   B19  ITEM NRO                       → "1"
//   C19  PRODUCTO / ACTIVIDAD           → row.description
//   W19  UND                            → "SERV"
//   AC19 CANT.                          → 1
//   AJ19 VR UNITARIO                    → row.amount
//   AS19 VALOR (fórmula)                → se preserva
//   B26  NOTA 2 FORMA DE PAGO           → "Contado" (default) o texto derivado

import {
  readWorkbook,
  setVal,
  todayAsExcelSerial,
  writeWorkbook,
  getSheet,
} from "./xlsx-helpers";
import type { Filler } from "./types";
import type { OsRow } from "./entity-data";

export const osFiller: Filler = async ({ templateBytes, data, context }) => {
  const row = data as OsRow;
  const wb = readWorkbook(templateBytes);
  const ws = getSheet(wb);

  // 1) Encabezado
  if (context.today) {
    setVal(ws, "C6", context.today);
    setVal(ws, "AC6", todayAsExcelSerial(context.today));
  }
  if (row.expenseNumber) setVal(ws, "I6", row.expenseNumber);

  // 2) Comprador / proyecto (cliente siempre es Marzo Triangular)
  setVal(ws, "C7", "MARZO TRIANGULAR S.A.S");
  setVal(ws, "I7", "830055571-1");
  if (context.project) {
    setVal(ws, "C8", context.project.location);
    setVal(ws, "C9", context.project.name);
  }
  if (context.provider) {
    setVal(ws, "I8", context.provider.name);
    setVal(ws, "C10", context.provider.name);
    setVal(ws, "C11", context.provider.nit);
    setVal(ws, "I11", "NIT");
    if (context.provider.email) setVal(ws, "I12", context.provider.email);
    if (context.provider.phone) {
      setVal(ws, "I9", context.provider.phone);
      setVal(ws, "C13", context.provider.phone);
    }
  }
  setVal(ws, "C15", context.provider?.name ?? "");

  // 3) Item principal (la OS estándar tiene 1 línea)
  setVal(ws, "B19", 1);
  setVal(ws, "C19", row.description);
  setVal(ws, "W19", "SERV");
  setVal(ws, "AC19", 1);
  setVal(ws, "AJ19", row.amount);
  // AS19 (VALOR) tiene fórmula — se preserva.

  // 4) NOTA 2 — forma de pago (default "Contado" para OS)
  setVal(ws, "B26", "NOTA 2: FORMA DE PAGO: Contado");

  return {
    content: writeWorkbook(wb),
    mimetype:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
};
