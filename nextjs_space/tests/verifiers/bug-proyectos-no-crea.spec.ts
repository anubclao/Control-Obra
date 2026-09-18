/**
 * tests/verifiers/bug-proyectos-no-crea.spec.ts
 * Verifier para docs/specs/bug-proyectos-no-crea.md
 *
 * STATUS: GREEN una vez aplicado el fix de AC-5.
 *
 * El bug real es de UI: el form llamaba a onSuccess() INMEDIATAMENTE
 * después de invocar addProject, sin esperar el resultado. Se valida
 * con análisis estático del source del componente.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(here, "../../src/components/projects/project-form.tsx");

let source = "";
beforeAll(() => {
  source = readFileSync(SRC_PATH, "utf8");
});

describe("Bug proyectos — AC-5: onSubmit debe ser async y await al store", () => {
  it("AC-5: el handler de submit está marcado como async", () => {
    expect(source).toMatch(/async\s+function\s+onSubmit/);
  });

  it("AC-5: el handler hace await sobre addProject al crear", () => {
    const creating = source.match(/else\s*{[\s\S]*?addProject[\s\S]*?}/);
    expect(creating, "rama de creación no encontrada").toBeTruthy();
    expect(creating![0]).toMatch(/await\s+addProject/);
  });

  it("AC-5: el handler hace await sobre updateProject al editar", () => {
    const editing = source.match(
      /if\s*\(project\)\s*{[\s\S]*?updateProject[\s\S]*?}/,
    );
    expect(editing, "rama de edición no encontrada").toBeTruthy();
    expect(editing![0]).toMatch(/await\s+updateProject/);
  });

  it("AC-5: onSuccess() solo se invoca si el resultado del store es truthy", () => {
    const creating = source.match(
      /else\s*{[\s\S]*?addProject[\s\S]*?onSuccess[\s\S]*?}\s*}/,
    );
    expect(creating, "estructura de submit no encontrada").toBeTruthy();
    expect(creating![0]).toMatch(/if\s*\([^)]+\)\s*onSuccess\(/);
  });
});
