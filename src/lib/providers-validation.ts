/**
 * lib/providers-validation.ts
 *
 * Reglas de validación del módulo PROVEEDORES — funciones puras, sin BD ni React.
 *
 * Fuente única de verdad: la ruta /api/providers importa estos helpers.
 *
 * El índice UNIQUE de MySQL (`uk_providers_nit`) compara la cadena literal, así
 * que "900.111.222-3" y "9001112223" pasarían como distintos. La unicidad real
 * se decide sobre el NIT normalizado.
 *
 * SPEC: docs/specs/unique-provider-nit.md
 */

/** Quita espacios, puntos y guiones, y pasa a mayúsculas. */
export function normalizeNit(nit: string): string {
  return nit.replace(/[\s.\-]/g, "").toUpperCase();
}

export function isBlankNit(nit: string | null | undefined): boolean {
  return !nit || !nit.trim();
}

export interface ProviderNitRef {
  id: string;
  name: string;
  nit: string;
}

/** Ver la nota de narrowing en lib/cuts-workflow.ts. */
export type NitValidationResult =
  | { ok: true; normalized: string; code?: undefined; error?: undefined }
  | {
      ok: false;
      normalized?: undefined;
      code: "NIT_REQUIRED" | "NIT_DUPLICATED";
      error: string;
    };

/**
 * Devuelve el proveedor existente que ya usa ese NIT (normalizado), o undefined.
 * `excludeId` permite editar un proveedor sin que choque consigo mismo (AC-2).
 */
export function findProviderByNit(
  providers: ProviderNitRef[],
  nit: string,
  excludeId?: string,
): ProviderNitRef | undefined {
  const normalized = normalizeNit(nit);
  return providers.find(
    (p) => p.id !== excludeId && normalizeNit(p.nit) === normalized,
  );
}

/**
 * Valida NIT no vacío y único frente a la lista dada.
 * Mensaje de AC-4: incluye el NIT intentado y el nombre del proveedor existente.
 */
export function validateProviderNit(
  providers: ProviderNitRef[],
  nit: string,
  excludeId?: string,
): NitValidationResult {
  if (isBlankNit(nit)) {
    return {
      ok: false,
      code: "NIT_REQUIRED",
      error: "El NIT / Cédula es obligatorio",
    };
  }

  const existing = findProviderByNit(providers, nit, excludeId);
  if (existing) {
    return {
      ok: false,
      code: "NIT_DUPLICATED",
      error: `Ya existe un proveedor con NIT "${nit}": ${existing.name}`,
    };
  }

  return { ok: true, normalized: normalizeNit(nit) };
}
