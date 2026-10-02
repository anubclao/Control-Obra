// VERIFIER: Unique NIT Validation in Provider Creation
// SPEC: /docs/specs/unique-provider-nit.md
//
// El store sincrónico providers-store.ts ya no existe: la validación vive en
// lib/providers-validation.ts y la consume /api/providers (POST y PUT).

import { describe, it, expect } from "vitest";
import {
  findProviderByNit,
  normalizeNit,
  validateProviderNit,
  type ProviderNitRef,
} from "@/lib/providers-validation";

const EXISTENTES: ProviderNitRef[] = [
  { id: "p1", name: "Estructuras del Norte S.A.S", nit: "900.111.222-3" },
  { id: "p2", name: "Aceros y Mallas Ltda", nit: "800.555.444-1" },
];

describe("Providers — validación de NIT único", () => {
  describe("AC-1: rechaza NIT duplicado al crear", () => {
    it("duplicado exacto", () => {
      const result = validateProviderNit(EXISTENTES, "900.111.222-3");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("NIT_DUPLICATED");
        expect(result.error).toContain("900.111.222-3");
      }
    });

    it("duplicado sin puntos ni guiones", () => {
      const result = validateProviderNit(EXISTENTES, "9001112223");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("NIT_DUPLICATED");
    });

    it("duplicado con separadores distintos", () => {
      for (const nit of ["900-111-222-3", "900 111 222 3", "900.111.222 3"]) {
        const result = validateProviderNit(EXISTENTES, nit);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.code).toBe("NIT_DUPLICATED");
      }
    });

    it("permite un NIT nuevo", () => {
      const result = validateProviderNit(EXISTENTES, "99.999.999-9");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.normalized).toBe("999999999");
    });
  });

  describe("AC-2: editar no choca consigo mismo", () => {
    it("el mismo proveedor con su mismo NIT pasa", () => {
      const result = validateProviderNit(EXISTENTES, "900.111.222-3", "p1");
      expect(result.ok).toBe(true);
    });

    it("pero sí choca con el NIT de OTRO proveedor", () => {
      const result = validateProviderNit(EXISTENTES, "800.555.444-1", "p1");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("Aceros y Mallas Ltda");
    });
  });

  describe("AC-3: normalización", () => {
    it("quita espacios, puntos y guiones y pasa a mayúsculas", () => {
      expect(normalizeNit("900.111.222-3")).toBe("9001112223");
      expect(normalizeNit("900-111-222-3")).toBe("9001112223");
      expect(normalizeNit(" 900 111 222 3 ")).toBe("9001112223");
      expect(normalizeNit("cc-1.234-a")).toBe("CC1234A");
    });

    it("findProviderByNit encuentra por valor normalizado", () => {
      expect(findProviderByNit(EXISTENTES, "9001112223")?.id).toBe("p1");
      expect(findProviderByNit(EXISTENTES, "123")).toBeUndefined();
    });
  });

  describe("AC-4: mensaje de error claro", () => {
    it("incluye el NIT intentado y el nombre del proveedor existente", () => {
      const result = validateProviderNit(EXISTENTES, "900.111.222-3");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(
          'Ya existe un proveedor con NIT "900.111.222-3": Estructuras del Norte S.A.S',
        );
      }
    });

    it("cita el NIT tal como lo escribió el usuario, no el normalizado", () => {
      const result = validateProviderNit(EXISTENTES, "900-111-222-3");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("900-111-222-3");
    });
  });

  describe("Edge Cases", () => {
    it("NIT vacío o solo whitespace se rechaza antes de la unicidad", () => {
      for (const nit of ["", "   ", "\t"]) {
        const result = validateProviderNit(EXISTENTES, nit);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.code).toBe("NIT_REQUIRED");
      }
    });

    it("con lista vacía, el primer proveedor siempre pasa", () => {
      const result = validateProviderNit([], "111.111.111-1");
      expect(result.ok).toBe(true);
    });
  });
});
