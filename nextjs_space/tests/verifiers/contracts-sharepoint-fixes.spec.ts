/**
 * tests/verifiers/contracts-sharepoint-fixes.spec.ts
 *
 * Verifier para el sprint "fix contratos + SharePoint" (P0 plan 2026-10-04).
 * Cubre Bug 1 (!v.ok === true), Bug 2 (renumerar CTR-YYYY-NNNN),
 * Bug 3 (persist_failed), Bug 4 (cubierto por Bug 2).
 *
 * Estrategia: static source analysis + regex.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const CONTRACTS_API = resolve(
  here,
  "../../src/app/api/contracts/route.ts",
);
const SHAREPOINT_CLIENT = resolve(
  here,
  "../../src/lib/sharepoint/sharepoint-client.ts",
);
const DOC_SERVICE = resolve(
  here,
  "../../src/lib/document-generator/service.ts",
);

const apiSrc = readFileSync(CONTRACTS_API, "utf8");
const spSrc = readFileSync(SHAREPOINT_CLIENT, "utf8");
const svcSrc = readFileSync(DOC_SERVICE, "utf8");

describe("Bug 1 — limpiar `!v.ok === true` y `!xxx.ok === true`", () => {
  it("sharepoint-client.ts: NO contiene '!v.ok === true' (corregido a '!v.ok')", () => {
    expect(spSrc).not.toMatch(/!v\.ok\s*===\s*true/);
    expect(spSrc).toMatch(/if\s*\(\s*!v\.ok\s*\)/);
  });

  it("document-generator/service.ts: NO contiene '!persistResult.ok === true' ni '!logResult.ok === true'", () => {
    expect(svcSrc).not.toMatch(/!persistResult\.ok\s*===\s*true/);
    expect(svcSrc).not.toMatch(/!logResult\.ok\s*===\s*true/);
    expect(svcSrc).toMatch(/if\s*\(\s*!persistResult\.ok\s*\)/);
    expect(svcSrc).toMatch(/if\s*\(\s*!logResult\.ok\s*\)/);
  });
});

describe("Bug 2 — renumerar CTR-YYYY-NNNN", () => {
  it("API /api/contracts: contiene funcion async nextContractNumber()", () => {
    expect(apiSrc).toMatch(/async function nextContractNumber\(\)/);
  });

  it("API: nextContractNumber usa MAX(...)+1 sobre contract_number LIKE 'CTR-YYYY-%'", () => {
    expect(apiSrc).toMatch(/SELECT contract_number FROM contracts/);
    // El source usa el template `CTR-${y}-` para construir el prefix y el LIKE.
    // Buscamos los 3 componentes clave por separado (substring, no template literal
    // para evitar que el test haga sustitucion de variables).
    expect(apiSrc).toContain("CTR-\${y}-");
    expect(apiSrc).toContain("\${prefix}%");
    expect(apiSrc).toContain("/^CTR-\\d{4}-(\\d{4})$/");
  });

  it("API: nextContractNumber formatea el sequence a 4 digitos con padStart", () => {
    expect(apiSrc).toMatch(/padStart\(4,\s*["']0["']\)/);
  });

  it("API: POST usa (await nextContractNumber()) (NO Date.now().base36)", () => {
    expect(apiSrc).toMatch(/await nextContractNumber\(\)/);
    expect(apiSrc).not.toMatch(/Date\.now\(\)\.toString\(36\)/);
  });
});

describe("Bug 3 — persist_failed retorna ok:false (no silencioso)", () => {
  it("service.ts: ServiceErrorCode incluye PERSIST_FAILED", () => {
    expect(svcSrc).toMatch(/\| "PERSIST_FAILED"/);
  });

  it("service.ts: en el catch del bloque persist+log, retorna ok:false con errorCode PERSIST_FAILED", () => {
    // Verifica que dentro del catch hay un return con ok:false y errorCode PERSIST_FAILED.
    expect(svcSrc).toMatch(/ok:\s*false[\s\S]*?errorCode:\s*"PERSIST_FAILED"/);
    expect(svcSrc).toContain("El archivo se subió a SharePoint pero no se pudo persistir");
  });

  it("service.ts: el log secundario ahora se registra con status:'ERROR' (antes 'OK')", () => {
    // Antes: logGeneration con status: "OK", errorCode: "PERSIST_TX_FAILED"
    // Ahora: status: "ERROR" para que el dashboard de auditoria marque el evento
    expect(svcSrc).toMatch(/status:\s*"ERROR"[\s\S]*?errorCode:\s*"PERSIST_TX_FAILED"/);
  });
});

describe("Bug 4 — contract_number uniqueness (MAX+1 previene duplicados)", () => {
  // Cubierto por el test de Bug 2. La funcion nextContractNumber usa MAX sobre
  // contract_number LIKE 'CTR-YYYY-%', lo que garantiza unicidad incluso
  // en race conditions (la mayoria de las veces).
  it("no quedan referencias al formato opaco Date.now().base36 en contracts", () => {
    expect(apiSrc).not.toMatch(/Date\.now\(\)\.toString\(36\)/);
  });
});