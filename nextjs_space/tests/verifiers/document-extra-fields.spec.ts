// filepath: tests/verifiers/document-extra-fields.spec.ts
// Verifier de extra-fields.ts. Cubre validación de los campos extra que
// cada plantilla exige del form.

import { describe, it, expect } from "vitest";
import {
  EXTRA_FIELDS,
  listExtraFieldNames,
} from "@/lib/document-generator/extra-fields";
import { z } from "zod";

describe("document-generator/extra-fields — AD-0033 (anticipo)", () => {
  const schema = EXTRA_FIELDS["AD-0033"];

  it("acepta un anticipo válido", () => {
    const r = schema.safeParse({
      itemAPagar: "Cimentación fase 1",
      plazoAmortizacionDias: 90,
    });
    expect(r.success).toBe(true);
  });

  it("rechaza plazoAmortizacionDias fuera de rango (>365)", () => {
    const r = schema.safeParse({
      itemAPagar: "Cimentación fase 1",
      plazoAmortizacionDias: 400,
    });
    expect(r.success).toBe(false);
  });

  it("rechaza itemAPagar demasiado corto", () => {
    const r = schema.safeParse({
      itemAPagar: "x",
      plazoAmortizacionDias: 30,
    });
    expect(r.success).toBe(false);
  });

  it("rechaza plazoAmortizacionDias no entero", () => {
    const r = schema.safeParse({
      itemAPagar: "Cimentación fase 1",
      plazoAmortizacionDias: 30.5,
    });
    expect(r.success).toBe(false);
  });
});

describe("document-generator/extra-fields — OC (orden de compra)", () => {
  const schema = EXTRA_FIELDS.OC;

  it("acepta una OC con 2 ítems válidos", () => {
    const r = schema.safeParse({
      items: [
        {
          descripcion: "Cuñete pintura",
          cantidad: 4,
          unidad: "UND",
          valorUnitario: 701680,
        },
        {
          descripcion: "Galón pintura",
          cantidad: 2,
          unidad: "GL",
          valorUnitario: 89075,
        },
      ],
      condicionPago: "CREDITO_30",
      lugarEntrega: "Obra Malva",
    });
    expect(r.success).toBe(true);
  });

  it("rechaza OC sin ítems", () => {
    const r = schema.safeParse({
      items: [],
      condicionPago: "CONTADO",
      lugarEntrega: "Obra",
    });
    expect(r.success).toBe(false);
  });

  it("rechaza condicionPago fuera del enum", () => {
    const r = schema.safeParse({
      items: [
        { descripcion: "X", cantidad: 1, unidad: "UND", valorUnitario: 100 },
      ],
      condicionPago: "CREDITO_45",
      lugarEntrega: "Obra",
    });
    expect(r.success).toBe(false);
  });

  it("rechaza cantidad ≤ 0", () => {
    const r = schema.safeParse({
      items: [
        { descripcion: "X", cantidad: 0, unidad: "UND", valorUnitario: 100 },
      ],
      condicionPago: "CONTADO",
      lugarEntrega: "Obra",
    });
    expect(r.success).toBe(false);
  });
});

describe("document-generator/extra-fields — LEG (legalización)", () => {
  const schema = EXTRA_FIELDS.LEG;

  it("acepta legalización con saldo a favor positivo", () => {
    const r = schema.safeParse({
      anticipoRelacionadoId: "abc-123",
      saldoAFavor: 50000,
      numeroFacturas: 3,
    });
    expect(r.success).toBe(true);
  });

  it("acepta legalización con saldo en contra (negativo)", () => {
    const r = schema.safeParse({
      anticipoRelacionadoId: "abc-123",
      saldoAFavor: -25000,
      numeroFacturas: 2,
    });
    expect(r.success).toBe(true);
  });

  it("rechaza numeroFacturas = 0", () => {
    const r = schema.safeParse({
      anticipoRelacionadoId: "abc-123",
      saldoAFavor: 0,
      numeroFacturas: 0,
    });
    expect(r.success).toBe(false);
  });
});

describe("document-generator/extra-fields — listExtraFieldNames", () => {
  it("OC lista items, condicionPago, lugarEntrega", () => {
    const fields = listExtraFieldNames("OC");
    expect(fields).toEqual(["items", "condicionPago", "lugarEntrega"]);
  });

  it("AD-0033 lista itemAPagar, plazoAmortizacionDias", () => {
    const fields = listExtraFieldNames("AD-0033");
    expect(fields).toEqual(["itemAPagar", "plazoAmortizacionDias"]);
  });

  it("CONT_LABORAL lista cargo, salario, fechaInicio, tipoContrato", () => {
    const fields = listExtraFieldNames("CONT_LABORAL");
    expect(fields).toEqual(["cargo", "salario", "fechaInicio", "tipoContrato"]);
  });
});

describe("document-generator/extra-fields — sanity", () => {
  it("todas las 10 plantillas tienen un schema registrado", () => {
    const required: Array<keyof typeof EXTRA_FIELDS> = [
      "AD-0033",
      "LEG",
      "OC",
      "OS",
      "CORTE",
      "AUSENCIA",
      "CONT_GLOBAL",
      "CONT_UNITARIO",
      "CONT_DISENOS",
      "CONT_LABORAL",
    ];
    for (const t of required) {
      expect(EXTRA_FIELDS[t], `falta schema para ${t}`).toBeDefined();
    }
  });

  it("los schemas son z.ZodObject (no strings sueltos)", () => {
    for (const [id, schema] of Object.entries(EXTRA_FIELDS)) {
      expect(schema instanceof z.ZodType, `schema de ${id} no es ZodType`).toBe(
        true,
      );
    }
  });
});
