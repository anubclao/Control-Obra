// filepath: src/lib/document-generator/fillers/xlsx-helpers.ts
// Helpers compartidos por todos los fillers xlsx (anticipo, legalizacion,
// os, corte, oc). Patrón:
//
//   const ws = readSheet(templateBytes, sheetName?);
//   setVal(ws, "G9", "valor");           // número o string
//   setVal(ws, "G9", 1234);               // numérico
//   setIfEmpty(ws, "B5", "default");     // solo si la celda está vacía
//   const out = writeWorkbook(wb);

import * as XLSX from "xlsx";

/** Lee un workbook preservando fórmulas (`cellFormula: true`). */
export function readWorkbook(
  bytes: Buffer,
  opts: { cellFormula?: boolean; cellStyles?: boolean } = {},
): XLSX.WorkBook {
  return XLSX.read(bytes, {
    type: "buffer",
    cellFormula: opts.cellFormula ?? true,
    cellStyles: opts.cellStyles ?? true,
  });
}

/** Devuelve la primera hoja (o la nombrada). */
export function getSheet(
  wb: XLSX.WorkBook,
  sheetName?: string,
): XLSX.WorkSheet {
  const name = sheetName ?? wb.SheetNames[0];
  if (!name) throw new Error("Workbook has no sheets");
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet '${name}' not found`);
  return ws;
}

/**
 * Asigna valor a una celda preservando su fórmula si existe.
 * - Si la celda tiene `f` (fórmula): solo actualiza `v` (valor cacheado).
 * - Si la celda está vacía: crea una nueva.
 * - Si la celda tiene valor normal: lo sobrescribe.
 */
export function setVal(
  ws: XLSX.WorkSheet,
  addr: string,
  value: string | number,
): void {
  const cell = ws[addr];
  if (cell && cell.f) {
    cell.v = value;
    cell.w = String(value);
    if (typeof value === "number") cell.t = "n";
    return;
  }
  ws[addr] = {
    t: typeof value === "number" ? "n" : "s",
    v: value,
  };
}

/** setVal solo si la celda está vacía o es null/undefined. */
export function setIfEmpty(
  ws: XLSX.WorkSheet,
  addr: string,
  value: string | number,
): void {
  const cell = ws[addr];
  if (!cell || cell.v === undefined || cell.v === null || cell.v === "") {
    setVal(ws, addr, value);
  }
}

/** Devuelve la fecha de hoy como serial Excel (1900 epoch). */
export function todayAsExcelSerial(today: string): number {
  const [y, m, d] = today.split("-").map(Number);
  const epoch = Date.UTC(1899, 11, 30);
  const target = Date.UTC(y, m - 1, d);
  return Math.round((target - epoch) / 86400000);
}

/** Serializa el workbook de vuelta a bytes xlsx preservando estilos. */
export function writeWorkbook(wb: XLSX.WorkBook): Buffer {
  const out = XLSX.write(wb, {
    type: "buffer",
    bookType: "xlsx",
    cellStyles: true,
  });
  return out as Buffer;
}

/** Convierte un número a su representación en letras (español básico, COP).
 *  Para evitar la dependencia de `numero-a-letras`, usamos una versión
 *  muy simple: millones + miles. Si se necesita precisión legal se
 *  reemplaza con un helper auditado.
 */
export function numeroALetrasCOP(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "CERO PESOS M/CTE";
  const entero = Math.floor(Math.abs(value));
  const millones = Math.floor(entero / 1_000_000);
  const miles = Math.floor((entero % 1_000_000) / 1_000);
  const unidades = entero % 1_000;
  const parts: string[] = [];
  if (millones) parts.push(`${millones} MILLONES`);
  if (miles) parts.push(`${miles} MIL`);
  if (unidades) parts.push(String(unidades));
  return `${parts.join(" ")} PESOS M/CTE`;
}
