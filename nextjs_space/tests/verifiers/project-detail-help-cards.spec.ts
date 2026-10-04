/**
 * tests/verifiers/project-detail-help-cards.spec.ts
 *
 * Verifier para docs/specs/project-detail-help-cards.md
 *
 * Estrategia: static source analysis con readFileSync + regex (mismo patron
 * que tests/verifiers/project-form-edit.spec.ts y bug-project-form-currency-step).
 * Permite verificar copy y estrutura sin necesidad de RTL/DOM mocking.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const PAGE = resolve(here, "../../src/app/tecnico/proyectos/[id]/page.tsx");

const src = readFileSync(PAGE, "utf8");

describe("Cards de ayuda en proyectos/[id] — cobertura de archivos", () => {
  it("importa ModuleExplanationCard desde @/components/ui/module-explanation-card", () => {
    expect(src).toMatch(/from\s+["']@\/components\/ui\/module-explanation-card["']/);
  });

  it("usa la card en el tab Resumen con storageKey project-detail:resumen", () => {
    expect(src).toMatch(/<ModuleExplanationCard[\s\S]*?title="Vista general del proyecto"[\s\S]*?storageKey="project-detail:resumen"/);
  });

  it("usa la card en el tab Presupuesto con storageKey project-detail:presupuesto", () => {
    expect(src).toMatch(/<ModuleExplanationCard[\s\S]*?title="Presupuesto Tope \(PT\)"[\s\S]*?storageKey="project-detail:presupuesto"/);
  });

  it("usa la card en el tab Cortes con storageKey project-detail:cortes", () => {
    expect(src).toMatch(/<ModuleExplanationCard[\s\S]*?title="Cortes de obra"[\s\S]*?storageKey="project-detail:cortes"/);
  });

  it("usa la card en el tab Contratistas con storageKey project-detail:contratistas", () => {
    expect(src).toMatch(/<ModuleExplanationCard[\s\S]*?title="Contratistas y proveedores"[\s\S]*?storageKey="project-detail:contratistas"/);
  });

  it("usa la card en el tab Bitacora con storageKey project-detail:bitacora", () => {
    expect(src).toMatch(/<ModuleExplanationCard[\s\S]*?title="Bitacora del proyecto"[\s\S]*?storageKey="project-detail:bitacora"/);
  });

  it("incluye el icono correspondiente en cada card (Activity/Calculator/Scissors/Truck/BookOpen)", () => {
    // Las 5 cards usan los iconos ya importados (Activity, Calculator, Scissors, Truck, BookOpen).
    // Verificamos que se referencian al menos 5 veces en ModuleExplanationCard.
    const iconMatches = src.match(/icon=\{Activity\}|icon=\{Calculator\}|icon=\{Scissors\}|icon=\{Truck\}|icon=\{BookOpen\}/g);
    expect(iconMatches).not.toBeNull();
    expect(iconMatches!.length).toBeGreaterThanOrEqual(5);
  });
});

describe("Cards de ayuda en proyectos/[id] — contenido minimo", () => {
  it("card Resumen menciona presupuesto, ejecutado, cortes y avance", () => {
    const block = src.match(/title="Vista general del proyecto"([\s\S]*?)storageKey="project-detail:resumen"/);
    expect(block).not.toBeNull();
    const text = block![1];
    expect(text).toMatch(/Presupuesto/);
    expect(text).toMatch(/Ejecutado/);
    expect(text).toMatch(/Cortes/);
    expect(text).toMatch(/Avance/);
  });

  it("card Presupuesto advierte que el VALOR TOTAL debe coincidir al centavo", () => {
    expect(src).toMatch(/VALOR TOTAL[\s\S]{0,200}centavo/);
  });

  it("card Cortes describe el ciclo DRAFT -> SUBMITTED -> VALIDATED -> APPROVED -> PAID", () => {
    expect(src).toMatch(/DRAFT[\s\S]{0,100}VALIDATED[\s\S]{0,100}APPROVED[\s\S]{0,100}PAID/);
  });

  it("card Contratistas menciona que Docs vencidos bloquea nuevos cortes", () => {
    expect(src).toMatch(/Docs vencidos[\s\S]{0,200}bloquea/);
  });

  it("card Bitacora advierte sobre auditorias", () => {
    expect(src).toMatch(/Bitacora[\s\S]{0,500}auditorias/);
  });
});

describe("Bug fix contratistas — no usa slice(0, 3) y muestra empty state", () => {
  it("NO contiene slice(0, 3) (placeholder eliminado)", () => {
    expect(src).not.toMatch(/slice\(0,\s*3\)/);
  });

  it("muestra empty state cuando projectProviders.length === 0", () => {
    expect(src).toMatch(/projectProviders\.length\s*===\s*0\s*\?\s*\([\s\S]*?Aun no hay proveedores vinculados/);
  });

  it("el boton Vincular tiene title explicativo de por que esta disabled", () => {
    expect(src).toMatch(/title="Disponible cuando exista la tabla project_providers en BD\."/);
  });

  it("ya no tiene el TODO de project_providers como codigo vivo (queda como comentario historico)", () => {
    // El TODO se reemplazo por un comentario historico en la linea 86-87.
    // Verificamos que el placeholder ya no este en codigo activo.
    expect(src).not.toMatch(/placeholders?:\s*primeros 3/);
  });
});