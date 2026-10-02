// filepath: src/lib/document-generator/fillers/oc.ts
// Filler para "3.5. FORMATO OC_ ORDEN DE COMPRA.xlsx".
// Refactor F2: lee del row de `expenses` con type ORDEN_COMPRA_*.
//
// Mapeo de celdas (verificado leyendo la plantilla real):
//   G6  FECHA (texto)              → context.today
//   I6  FECHA (serial Excel)       → todayAsExcelSerial(context.today)
//   G7  COMPRADOR                  → context.project?.client ?? "—"
//   G8  DIRECCION DESPACHO         → context.project?.location ?? "—"
//   G9  OBRA                       → context.project?.name ?? "—"
//   G10 PROVEEDOR                  → context.provider?.name ?? "—"
//   G11 IDENTIFICACION             → context.provider?.nit ?? "—"
//   H11 TIPO                       → "NIT"
//   I9  TEL                        → context.provider?.phone ?? ""
//   I15 CONTACTO VENTAS            → context.provider?.phone ?? ""
//   ──── Item (fila 19) ────
//   H19 DESCRIPCIÓN                → row.description
//   I19 CANTIDAD                   → 1
//   K19 UND                        → "UND"
//   R19 VR UNITARIO                → row.amount
//   (L19, O19, S19 son fórmulas — se preservan)
//   C14 LUGAR DE ENTREGA           → "Obra principal" (default)
//   C28 Forma de pago              → "Contado" (default)

import * as XLSX from "xlsx";
import type { Filler, FillerResult } from "./types";
import type { OcRow } from "./entity-data";

/** Fecha Excel (serie 1900) para HOY. */
function todayAsExcelSerial(today: string): number {
  const [y, m, d] = today.split("-").map(Number);
  const epoch = Date.UTC(1899, 11, 30);
  const target = Date.UTC(y, m - 1, d);
  return Math.round((target - epoch) / 86400000);
}

export const ocFiller: Filler = async ({ templateBytes, data, context }) => {
  const row = data as OcRow;

  const wb = XLSX.read(templateBytes, { type: "buffer", cellFormula: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error("OC template has no sheets");
  }
  const ws = wb.Sheets[sheetName]!;

  const setVal = (addr: string, value: string | number) => {
    const cell = ws[addr];
    if (cell && cell.f) {
      cell.v = value;
      cell.w = String(value);
    } else {
      ws[addr] = { t: typeof value === "number" ? "n" : "s", v: value };
    }
  };

  // 1) Encabezado
  if (context.project) {
    setVal("G7", context.project.client);
    setVal("G8", context.project.location);
    setVal("G9", context.project.name);
  }
  if (context.provider) {
    setVal("G10", context.provider.name);
    setVal("G11", context.provider.nit);
    setVal("H11", "NIT");
    if (context.provider.phone) {
      setVal("I9", context.provider.phone);
      setVal("I15", context.provider.phone);
    }
  }
  if (context.today) {
    setVal("G6", context.today);
    if (ws["I6"]) {
      ws["I6"].v = todayAsExcelSerial(context.today);
      ws["I6"].t = "n";
    }
  }

  // 2) Item principal (OC estándar: 1 línea en fila 19)
  setVal("H19", row.description);
  setVal("I19", 1);
  setVal("K19", "UND");
  setVal("R19", row.amount);
  // L19, O19, S19 son fórmulas — se preservan.

  // 3) Forma de pago y lugar de entrega
  setVal("C28", "Forma de pago: Contado");
  setVal("C14", "Obra principal");

  const out = XLSX.write(wb, {
    type: "buffer",
    bookType: "xlsx",
    cellStyles: true,
  });

  return {
    content: out as Buffer,
    mimetype:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
};
