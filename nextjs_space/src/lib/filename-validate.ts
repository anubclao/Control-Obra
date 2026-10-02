// filepath: src/lib/filename-validate.ts
// Validación de nombres de archivo para SharePoint.
//
// SharePoint acepta casi cualquier carácter en el `name` de un DriveItem
// (incluso `..` si se codifica correctamente), pero los archivos resultantes
// son inutilizables en Windows Explorer (caracteres prohibidos: `< > : " / \ | ? *`)
// y rompen el parseo de URLs en la UI. Validamos en una sola función para
// reusar desde la API route y desde el service.

const ALLOWED_CHARS = /^[A-Za-z0-9._-]+$/;
const MAX_LENGTH = 200;
const MIN_LENGTH = 1;
const RESERVED_WINDOWS = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

/**
 * Resultado de validar un nombre de archivo.
 */
export type FileNameValidation =
  | { ok: true; normalized: string }
  | { ok: false; reason: string };

/**
 * Valida un nombre de archivo para usarlo en SharePoint.
 * - Solo letras, dígitos, guion, guion bajo y punto.
 * - Sin segmentos "..", sin trailing ".", sin espacios.
 * - Longitud 1-200.
 * - Rechaza nombres reservados de Windows.
 * - Rechaza nombres que empiecen/terminen en punto (archivos ocultos en Unix).
 *
 * Si la validación pasa, devuelve `normalized` con los caracteres seguros
 * colapsados (trim, lower-case comparison para reservados).
 */
export function validateFileName(name: unknown): FileNameValidation {
  if (typeof name !== "string") {
    return { ok: false, reason: "no es string" };
  }
  if (name.length < MIN_LENGTH) {
    return { ok: false, reason: "demasiado corto" };
  }
  if (name.length > MAX_LENGTH) {
    return { ok: false, reason: `demasiado largo (max ${MAX_LENGTH})` };
  }
  if (!ALLOWED_CHARS.test(name)) {
    return {
      ok: false,
      reason:
        "caracteres no permitidos (solo letras, dígitos, guion, guion bajo, punto)",
    };
  }
  if (name.startsWith(".") || name.endsWith(".")) {
    return { ok: false, reason: "no puede empezar/terminar en punto" };
  }
  if (name === "." || name === "..") {
    return { ok: false, reason: "path traversal" };
  }
  // Rechazar reservados (case-insensitive)
  const stem = name.split(".")[0]?.toUpperCase() ?? "";
  if (RESERVED_WINDOWS.has(stem)) {
    return { ok: false, reason: `nombre reservado de Windows: ${stem}` };
  }
  return { ok: true, normalized: name };
}
