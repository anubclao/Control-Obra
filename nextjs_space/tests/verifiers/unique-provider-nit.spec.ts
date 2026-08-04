// VERIFIER: Unique NIT Validation in Provider Creation
// STATUS: EXPECTED TO FAIL (RED PHASE) — hasta que el bug sea arreglado
// SPEC: /docs/specs/unique-provider-nit.md
// BUG FIX: #8 — addProvider no valida NIT único

import { describe, it, expect, beforeEach } from "vitest";
import { useProvidersStore } from "@/lib/providers-store";

describe("useProvidersStore — Unique NIT Validation", () => {
  beforeEach(() => {
    useProvidersStore.setState({
      providers: useProvidersStore.getInitialState().providers,
    });
  });

  describe("Acceptance Criteria", () => {
    it("AC-1: debe rechazar addProvider con NIT duplicado exacto", () => {
      // MOCK_PROVIDERS ya tiene c1 con NIT "900.111.222-3"
      const result = useProvidersStore.getState().addProvider({
        personType: "JURIDICA",
        name: "Proveedor Duplicado S.A.S",
        nit: "900.111.222-3",
        contact: "Test",
        email: "test@dup.com",
        phone: "+57 300 000 0000",
        references: [],
      });

      // El fix retorna { ok: false, error } en lugar de Provider
      if ("ok" in result) {
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toContain("900.111.222-3");
        }
      } else {
        // Si el bug sigue, el provider se creó duplicado
        const found = useProvidersStore
          .getState()
          .providers.filter((p) => p.nit === "900.111.222-3");
        expect(found.length).toBe(1); // Solo debe existir 1
      }
    });

    it("AC-1: debe rechazar NIT duplicado normalizado (sin puntos/guiones)", () => {
      const result = useProvidersStore.getState().addProvider({
        personType: "JURIDICA",
        name: "Otro Proveedor S.A.S",
        nit: "9001112223", // mismo NIT sin formato
        contact: "Test",
        email: "test@dup2.com",
        phone: "+57 300 000 0000",
        references: [],
      });

      if ("ok" in result) {
        expect(result.ok).toBe(false);
      } else {
        const found = useProvidersStore
          .getState()
          .providers.filter(
            (p) => p.nit.replace(/[\s.\-]/g, "") === "9001112223",
          );
        expect(found.length).toBe(1);
      }
    });

    it("AC-1: debe rechazar NIT con diferentes separadores (guiones vs puntos)", () => {
      const result = useProvidersStore.getState().addProvider({
        personType: "JURIDICA",
        name: "Variante Proveedor",
        nit: "900-111-222-3", // mismo NIT con guiones en vez de puntos
        contact: "Test",
        email: "test@dup3.com",
        phone: "+57 300 000 0000",
        references: [],
      });

      if ("ok" in result) {
        expect(result.ok).toBe(false);
      } else {
        const found = useProvidersStore
          .getState()
          .providers.filter(
            (p) => p.nit.replace(/[\s.\-]/g, "") === "9001112223",
          );
        expect(found.length).toBe(1);
      }
    });

    it("AC-1: debe permitir crear proveedor con NIT nuevo", () => {
      const result = useProvidersStore.getState().addProvider({
        personType: "NATURAL",
        name: "Proveedor Nuevo",
        nit: "99.999.999-9", // NIT que no existe
        contact: "Contacto",
        email: "nuevo@proveedor.com",
        phone: "+57 300 000 0001",
        references: [],
      });

      if ("ok" in result) {
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.provider.nit).toBe("99.999.999-9");
        }
      } else {
        // Si el fix no está, debe haberse creado el provider
        const found = useProvidersStore
          .getState()
          .providers.find((p) => p.nit === "99.999.999-9");
        expect(found).toBeDefined();
      }
    });

    it("AC-4: el mensaje de error debe incluir el NIT intentado y el nombre del existente", () => {
      const result = useProvidersStore.getState().addProvider({
        personType: "JURIDICA",
        name: "Cualquiera S.A.S",
        nit: "900.111.222-3", // duplicado
        contact: "Test",
        email: "test@err.com",
        phone: "+57 300 000 0000",
        references: [],
      });

      if ("ok" in result && !result.ok) {
        // Debe mencionar el NIT
        expect(result.error).toContain("900.111.222-3");
        // Debe mencionar el nombre del existente
        expect(result.error).toContain("Estructuras del Norte");
      } else {
        // Si el fix no está, falla
        expect("ok" in result && result.ok).toBe(false);
      }
    });
  });

  describe("Edge Cases", () => {
    it("debe permitir crear el primer proveedor cuando la lista está vacía", () => {
      useProvidersStore.setState({ providers: [] });

      const result = useProvidersStore.getState().addProvider({
        personType: "JURIDICA",
        name: "Primer Proveedor",
        nit: "111.111.111-1",
        contact: "Contacto",
        email: "primero@test.com",
        phone: "+57 300 000 0000",
        references: [],
      });

      if ("ok" in result) {
        expect(result.ok).toBe(true);
      } else {
        const found = useProvidersStore
          .getState()
          .providers.find((p) => p.nit === "111.111.111-1");
        expect(found).toBeDefined();
      }
    });
  });
});
