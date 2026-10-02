/**
 * tests/verifiers/bug-project-form-currency-step.spec.ts
 *
 * Verifier del fix de presupuesto + label huérfana en project-form
 * (docs/specs/bug-project-form-currency-step.md, AC-1, AC-2, AC-4, AC-5, AC-6).
 *
 * Bug 1 (AC-1, AC-2, AC-6): el <Input id="totalBudget" type="number" /> usa
 *   step="1000000" → el navegador rechaza cualquier valor no múltiplo de 1M
 *   y muestra "valores válidos más aproximados son 76000000 y 77000000".
 *   El Zod schema acepta cualquier número ≥ 0, así que el problema es 100%
 *   de la validación HTML5 nativa del <input type="number">.
 *
 * Bug 2 (AC-4, AC-5): <Label htmlFor="status"> apunta a un <Select> cuyo
 *   <SelectTrigger> no tiene id="status" → warning DevTools:
 *   "Incorrect use of <label for=FORM_ELEMENT>" y click-en-label no mueve
 *   el foco al control.
 *
 * Estrategia: análisis estático del source con readFileSync (mismo patrón
 * que project-form-edit.spec.ts). No necesita RTL/DOM mocking para estos ACs.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const SRC = readFileSync(
  path.resolve(__dirname, "../../src/components/projects/project-form.tsx"),
  "utf8",
);

/** Extrae el bloque JSX del Input de totalBudget (delimitado por id="totalBudget"). */
function extractTotalBudgetBlock(source: string): string {
  const idx = source.indexOf('id="totalBudget"');
  if (idx === -1) return "";
  // Tomamos desde 200 chars antes para capturar el <Input ... completo.
  const start = Math.max(0, source.lastIndexOf("<Input", idx));
  const end = source.indexOf("/>", idx);
  return start === -1 || end === -1 ? "" : source.slice(start, end + 2);
}

/** Extrae el bloque JSX del SelectTrigger (busca <SelectTrigger ...>). */
function extractSelectTrigger(source: string): string {
  const m = source.match(/<SelectTrigger\b[\s\S]*?>/);
  return m ? m[0] : "";
}

/** Parsea `step="N"` (o step={N}) a número, o null si no aparece. */
function parseStepAttribute(block: string): number | null {
  const m = block.match(/\bstep\s*=\s*(?:"(\d+(?:\.\d+)?)"|{(\d+(?:\.\d+)?)})/);
  if (!m) return null;
  const v = m[1] ?? m[2];
  return v ? Number(v) : null;
}

describe("AC-1 · totalBudget NO usa step restrictivo (≥ 10000)", () => {
  const block = extractTotalBudgetBlock(SRC);

  it("Input de totalBudget existe en el source", () => {
    expect(block).not.toBe("");
    expect(block).toMatch(/id="totalBudget"/);
    expect(block).toMatch(/type="number"/);
  });

  it("NO tiene step=\"1000000\" (bug original)", () => {
    expect(block).not.toMatch(/\bstep\s*=\s*"1000000"/);
  });

  it("NO tiene step >= 10000 (anti-regresión: cualquier múltiplo restrictivo)", () => {
    const step = parseStepAttribute(block);
    if (step === null) return; // ausente también es válido (AC-2)
    expect(step).toBeLessThan(10000);
  });
});

describe("AC-2 · totalBudget acepta granularidad útil o cualquier valor", () => {
  const block = extractTotalBudgetBlock(SRC);

  it("step es null, \"any\" o <= 1000", () => {
    const step = parseStepAttribute(block);
    if (step === null) return; // ausente está OK
    // step="1000" (miles de COP) o menor
    expect(step).toBeLessThanOrEqual(1000);
  });

  it("el bloque referencia id=\"totalBudget\" y min (sigue siendo >= 0)", () => {
    expect(block).toMatch(/id="totalBudget"/);
    expect(block).toMatch(/\bmin\s*=\s*"0"/);
  });
});

describe("AC-3 · Zod schema sigue aceptando cualquier número >= 0", () => {
  it("el schema declara z.coerce.number().min(0)", () => {
    expect(SRC).toMatch(/totalBudget:\s*z\.coerce\.number\(\)\.min\(0/);
  });
});

describe("AC-4 · <Label htmlFor=\"status\"> apunta a un elemento con id real", () => {
  it("hay un <Label htmlFor=\"status\">", () => {
    expect(SRC).toMatch(/<Label\s+htmlFor="status">/);
  });

  it("existe un elemento con id=\"status\" en el source", () => {
    // Aceptamos que el id esté en SelectTrigger, SelectContent, etc.,
    // pero DEBE existir (no puede estar solo en el htmlFor).
    // NOTA: NO usar \b después del " de cierre — "\b" requiere un word
    // boundary, y el char siguiente es " (cierre), no un word char.
    expect(SRC).toMatch(/\bid="status"/);
  });
});

describe("AC-5 · <SelectTrigger> lleva id=\"status\" (solución más accesible)", () => {
  const trigger = extractSelectTrigger(SRC);

  it("<SelectTrigger> existe", () => {
    expect(trigger).not.toBe("");
  });

  it("<SelectTrigger> tiene id=\"status\"", () => {
    expect(trigger).toMatch(/\bid="status"/);
  });
});

describe("AC-6 · anti-regresión global en inputs de monto del módulo projects", () => {
  /**
   * Cualquier <Input type="number" step="N"> con step >= 10000 en
   * componentes/projects/ rompe valores de moneda. Hoy solo se valida
   * project-form.tsx, pero el patrón debe cubrir todo el directorio.
   */
  const projectsDir = path.resolve(__dirname, "../../src/components/projects");
  // Leemos todos los .tsx del directorio (excluyendo subdirs que no sean proyectos)
  let files: string[];
  try {
    const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
    files = readdirSync(projectsDir)
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => path.join(projectsDir, f))
      .filter((p) => statSync(p).isFile());
  } catch {
    files = [path.resolve(__dirname, "../../src/components/projects/project-form.tsx")];
  }

  it.each(files)("en %s no hay <Input type=\"number\"> con step >= 10000", (file) => {
    const src = readFileSync(file, "utf8");
    // Captura cada bloque <Input ... type="number" ... />
    const inputBlocks = src.match(/<Input\b[\s\S]*?type="number"[\s\S]*?\/>/g) ?? [];
    expect(inputBlocks.length).toBeGreaterThanOrEqual(0);
    for (const blk of inputBlocks) {
      const step = parseStepAttribute(blk);
      if (step === null) continue;
      expect(step).toBeLessThan(10000);
    }
  });
});