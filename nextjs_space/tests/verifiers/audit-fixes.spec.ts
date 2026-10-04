/**
 * tests/verifiers/audit-fixes.spec.ts
 *
 * Verifier para el sprint de auditoría (P0 plan 2026-10-04).
 * Cubre:
 *  - Bug 5: API /api/contracts devuelve documents + generatedDocumentUrl
 *  - Bug 6: API /api/employees devuelve documents
 *  - Bug 7: psc-detail.tsx valida items con `items = psc.items ?? []`
 *  - Bug 8: API /api/contracts valida longitud de TEXT
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
const EMPLOYEES_API = resolve(
  here,
  "../../src/app/api/employees/route.ts",
);
const PSC_DETAIL = resolve(
  here,
  "../../src/components/pscs/psc-detail.tsx",
);

const contractsSrc = readFileSync(CONTRACTS_API, "utf8");
const employeesSrc = readFileSync(EMPLOYEES_API, "utf8");
const pscDetailSrc = readFileSync(PSC_DETAIL, "utf8");

describe("Bug 5 — /api/contracts devuelve documents + generatedDocumentUrl", () => {
  it("function r() incluye documents en el response", () => {
    expect(contractsSrc).toMatch(/function r\(row: any, docs: any\[\] = \[\]/);
    expect(contractsSrc).toMatch(/documents: docs\.map\(\(d\) =>/);
  });

  it("function r() incluye generatedDocumentUrl", () => {
    expect(contractsSrc).toMatch(/generatedDocumentUrl/);
  });

  it("GET hace JOIN con contract_documents", () => {
    expect(contractsSrc).toMatch(/SELECT \* FROM contract_documents/);
    expect(contractsSrc).toMatch(/WHERE contract_id IN/);
  });
});

describe("Bug 6 — /api/employees devuelve documents", () => {
  it("function r() en employees incluye documents", () => {
    expect(employeesSrc).toMatch(/function r\(row: any, docs: any\[\] = \[\]/);
    expect(employeesSrc).toMatch(/documents: docs\.map\(\(d\) =>/);
  });

  it("GET hace JOIN con employee_documents", () => {
    expect(employeesSrc).toMatch(/SELECT \* FROM employee_documents/);
    expect(employeesSrc).toMatch(/WHERE employee_id IN/);
  });
});

describe("Bug 7 — psc-detail.tsx valida items con default []", () => {
  it("psc-detail.tsx tiene 'const items = psc.items ?? []' al inicio", () => {
    expect(pscDetailSrc).toMatch(/const items = psc\.items \?\? \[\]/);
  });

  it("psc-detail.tsx usa 'items.map' y 'items.reduce' (no 'psc.items' directamente)", () => {
    // Despues del const items, los usos siguientes deben ser sobre 'items'
    expect(pscDetailSrc).toMatch(/items\.map\(\(it\) =>/);
    expect(pscDetailSrc).toMatch(/items\.reduce/);
    // No debe quedar referencia directa a psc.items en operaciones peligrosas
    const directRefs = pscDetailSrc.match(/psc\.items\.(map|reduce|filter|find|some)/g);
    expect(directRefs).toBeNull();
  });
});

describe("Bug 8 — /api/contracts valida longitud de TEXT (5000 chars)", () => {
  it("POST valida scopeOfWork y notes con MAX_TEXT", () => {
    expect(contractsSrc).toMatch(/const MAX_TEXT = 5000/);
    // Verifica que la validacion aparece en POST (antes de pricingMode)
    expect(contractsSrc).toMatch(/scopeOfWork\.length > MAX_TEXT/);
    expect(contractsSrc).toMatch(/notes\.length > MAX_TEXT/);
  });

  it("PUT tambien valida scopeOfWork y notes", () => {
    // Cuenta que la validacion aparece al menos 2 veces (POST y PUT)
    const matches = contractsSrc.match(/length > MAX_TEXT/g);
    expect(matches && matches.length).toBeGreaterThanOrEqual(4);
  });
});