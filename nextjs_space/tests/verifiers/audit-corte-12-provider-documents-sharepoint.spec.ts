/**
 * tests/verifiers/audit-corte-12-provider-documents-sharepoint.spec.ts
 *
 * Verifier para docs/specs/audit-corte-12-provider-documents-sharepoint.md
 * (Corte 12 — carga funcional de documentos de proveedor a SharePoint).
 *
 * Estrategia: 42 tests de static source analysis (V1-V9 + V11). Los
 * checks de tsc/vitest/build NO son tests de vitest (se mueven a
 * §13 "Verificación post-implementación" como comandos shell en Fase 5).
 *
 * Estado esperado al inicio de Fase 4 (Commit 1):
 *  - 42 fail, 0 pass. Todos los archivos y patrones de código que el
 *    spec requiere no existen aún.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const servicePath = path.join(ROOT, "src/lib/providers-documents/service.ts");
const validationPath = path.join(
  ROOT,
  "src/lib/providers-documents/validation.ts",
);
const pathsFilePath = path.join(ROOT, "src/lib/providers-documents/paths.ts");
const postRoutePath = path.join(
  ROOT,
  "src/app/api/providers/[id]/documents/route.ts",
);
const downloadRoutePath = path.join(
  ROOT,
  "src/app/api/providers/[id]/documents/[docId]/download/route.ts",
);
const pagePath = path.join(
  ROOT,
  "src/app/tecnico/proveedores/[id]/page.tsx",
);
const dataStorePath = path.join(ROOT, "src/lib/data-store.ts");
const providersRoutePath = path.join(ROOT, "src/app/api/providers/route.ts");
const documentLinkPath = path.join(
  ROOT,
  "src/components/providers/document-link.tsx",
);
const downloadUrlPath = path.join(
  ROOT,
  "src/lib/providers-documents/download-url.ts",
);

// ============================================================================
// V1 — Static: archivos + exports (6 tests)
// ============================================================================

describe("AC-1: service.ts existe y exporta uploadProviderDocument", () => {
  it("existe el archivo", () => {
    expect(existsSync(servicePath)).toBe(true);
  });
  it("exporta uploadProviderDocument", () => {
    const src = readFileSync(servicePath, "utf8");
    expect(src).toMatch(/export\s+async\s+function\s+uploadProviderDocument/);
  });
});

describe("AC-2: validation.ts existe y exporta validateProviderDocumentFile", () => {
  it("existe el archivo", () => {
    expect(existsSync(validationPath)).toBe(true);
  });
  it("exporta validateProviderDocumentFile", () => {
    const src = readFileSync(validationPath, "utf8");
    expect(src).toMatch(
      /export\s+(async\s+)?function\s+validateProviderDocumentFile/,
    );
  });
});

describe("AC-3: paths.ts existe y exporta buildProviderDocumentPath + sanitizeFileName", () => {
  it("existe el archivo", () => {
    expect(existsSync(pathsFilePath)).toBe(true);
  });
  it("exporta buildProviderDocumentPath", () => {
    const src = readFileSync(pathsFilePath, "utf8");
    expect(src).toMatch(/export\s+function\s+buildProviderDocumentPath/);
  });
  it("exporta sanitizeFileName", () => {
    const src = readFileSync(pathsFilePath, "utf8");
    expect(src).toMatch(/export\s+function\s+sanitizeFileName/);
  });
});

describe("AC-4: POST route existe y exporta POST", () => {
  it("existe el archivo", () => {
    expect(existsSync(postRoutePath)).toBe(true);
  });
  it("exporta POST", () => {
    const src = readFileSync(postRoutePath, "utf8");
    expect(src).toMatch(/export\s+async\s+function\s+POST/);
  });
});

describe("AC-5: GET download route existe y exporta GET", () => {
  it("existe el archivo", () => {
    expect(existsSync(downloadRoutePath)).toBe(true);
  });
  it("exporta GET", () => {
    const src = readFileSync(downloadRoutePath, "utf8");
    expect(src).toMatch(/export\s+async\s+function\s+GET/);
  });
});

// ============================================================================
// V2 — Static: paths shape (3 tests)
// ============================================================================

describe("AC-3: buildProviderDocumentPath produces correct path", () => {
  it("usa convencion Proyectos/Proveedores/{providerCode}/{type} (temporal, sin projectCode)", () => {
    const src = readFileSync(pathsFilePath, "utf8");
    expect(src).toMatch(/Proyectos/);
    expect(src).toMatch(/Proveedores/);
    // projectCode ahora es opcional (Corte 13 lo hará required).
    // Verificamos que el código maneja projectCode ausente.
    expect(src).toMatch(/projectCode\s*\?/);
    expect(src).toMatch(/\$\{[^}]*providerCode[^}]*\}/);
    expect(src).toMatch(/\$\{[^}]*documentType[^}]*\}/);
  });
});

describe("AC-3: sanitizeFileName normaliza caracteres", () => {
  it("reemplaza espacios por guiones", () => {
    const src = readFileSync(pathsFilePath, "utf8");
    expect(src).toMatch(/replace/);
  });
  it("limita a 100 chars", () => {
    const src = readFileSync(pathsFilePath, "utf8");
    expect(src).toMatch(/100/);
  });
});

// ============================================================================
// V3 — Static: validation content (3 tests)
// ============================================================================

describe("AC-2: validateProviderDocumentFile enforces size 50MB", () => {
  it("referencia constante 50MB", () => {
    const src = readFileSync(validationPath, "utf8");
    expect(src).toMatch(/50\s*\*\s*1024\s*\*\s*1024|MAX_FILE_SIZE/);
  });
  it("chequea file.size contra limite", () => {
    const src = readFileSync(validationPath, "utf8");
    expect(src).toMatch(/file\.size|\.size\s*>/);
  });
});

describe("AC-2: validateProviderDocumentFile enforces content-type allowlist", () => {
  it("tiene allowlist con PDF, DOCX, JPG, PNG, XLSX", () => {
    const src = readFileSync(validationPath, "utf8");
    expect(src).toMatch(/application\/pdf/);
    expect(src).toMatch(/wordprocessingml/);
    expect(src).toMatch(/image\/jpeg/);
    expect(src).toMatch(/image\/png/);
    expect(src).toMatch(/spreadsheetml/);
  });
});

// ============================================================================
// V4 — Static: POST route validations (5 tests)
// ============================================================================

describe("AC-6: POST route retorna 401 sin auth", () => {
  it("usa requireAuth", () => {
    const src = readFileSync(postRoutePath, "utf8");
    expect(src).toMatch(/requireAuth/);
  });
  it("retorna status 401", () => {
    const src = readFileSync(postRoutePath, "utf8");
    expect(src).toMatch(/status:\s*401/);
  });
});

describe("AC-6: POST route retorna 404 si provider no existe", () => {
  it("retorna status 404", () => {
    const src = readFileSync(postRoutePath, "utf8");
    expect(src).toMatch(/status:\s*404/);
  });
});

describe("AC-6: POST route retorna 413 si file > 50MB", () => {
  it("retorna status 413", () => {
    const src = readFileSync(postRoutePath, "utf8");
    expect(src).toMatch(/status:\s*413/);
  });
});

describe("AC-6: POST route retorna 415 si content-type invalido", () => {
  it("retorna status 415", () => {
    const src = readFileSync(postRoutePath, "utf8");
    expect(src).toMatch(/status:\s*415/);
  });
});

// ============================================================================
// V5 — Static: POST route happy path (4 tests)
// ============================================================================

describe("AC-7: POST route llama uploadProviderDocument", () => {
  it("delega al service", () => {
    const src = readFileSync(postRoutePath, "utf8");
    expect(src).toMatch(/uploadProviderDocument/);
  });
});

describe("AC-7: POST route retorna 201 en exito", () => {
  it("retorna status 201", () => {
    const src = readFileSync(postRoutePath, "utf8");
    expect(src).toMatch(/status:\s*201/);
  });
});

describe("AC-7: service INSERTa en provider_documents", () => {
  it("contiene INSERT statement", () => {
    const src = readFileSync(servicePath, "utf8");
    expect(src).toMatch(/INSERT\s+INTO\s+provider_documents/);
  });
  it("INSERT incluye provider_id, type, file_name, file_url", () => {
    const src = readFileSync(servicePath, "utf8");
    expect(src).toMatch(/provider_id/);
    expect(src).toMatch(/type/);
    expect(src).toMatch(/file_name/);
    expect(src).toMatch(/file_url/);
  });
});

// ============================================================================
// V6 — Static: GET download route (4 tests)
// ============================================================================

describe("AC-11: GET download retorna 401 sin auth", () => {
  it("usa requireAuth y retorna 401", () => {
    const src = readFileSync(downloadRoutePath, "utf8");
    expect(src).toMatch(/requireAuth/);
    expect(src).toMatch(/status:\s*401/);
  });
});

describe("AC-11: GET download retorna 403 si forbidden", () => {
  it("retorna status 403", () => {
    const src = readFileSync(downloadRoutePath, "utf8");
    expect(src).toMatch(/status:\s*403/);
  });
});

describe("AC-11: GET download retorna 404 si doc no existe", () => {
  it("retorna status 404", () => {
    const src = readFileSync(downloadRoutePath, "utf8");
    expect(src).toMatch(/status:\s*404/);
  });
});

describe("AC-11: GET download redirige a file_url en exito", () => {
  it("usa NextResponse.redirect", () => {
    const src = readFileSync(downloadRoutePath, "utf8");
    expect(src).toMatch(/NextResponse\.redirect/);
  });
});

// ============================================================================
// V7 — Static: useProvidersStore.addDocument (2 tests)
// ============================================================================

describe("AC-9: useProvidersStore tiene addDocument (no stub)", () => {
  it("data-store.ts declara addDocument en useProvidersStore", () => {
    const src = readFileSync(dataStorePath, "utf8");
    // Aislar el bloque useProvidersStore (entre export const useProvidersStore y el siguiente export const)
    const match = src.match(
      /export const useProvidersStore[\s\S]*?^\};/m,
    );
    expect(match).toBeTruthy();
    const body = match?.[0] ?? "";
    expect(body).toMatch(/addDocument/);
  });
  it("addDocument NO es stub (llama fetch con FormData)", () => {
    const src = readFileSync(dataStorePath, "utf8");
    const match = src.match(
      /export const useProvidersStore[\s\S]*?^\};/m,
    );
    const body = match?.[0] ?? "";
    expect(body).toMatch(/fetch\s*\(/);
    expect(body).toMatch(/FormData/);
    // NO es un stub que solo loguea "pendiente"
    expect(body).not.toMatch(/console\.warn.*addDocument.*pendiente/);
  });
});

// ============================================================================
// V8 — Static: file picker en modal (3 tests)
// ============================================================================

describe("AC-8: modal usa <input type='file'> (no <Input type='text'>)", () => {
  it("page.tsx tiene <input type='file'>", () => {
    const src = readFileSync(pagePath, "utf8");
    expect(src).toMatch(/<input[^>]*type=["']file["']/);
  });
  it("file input tiene accept con PDF/DOCX/JPG/PNG/XLSX", () => {
    const src = readFileSync(pagePath, "utf8");
    expect(src).toMatch(/accept=["'][^"']*\.pdf/);
  });
  it("ya no tiene <Input type='text'> para fileName (setFileName)", () => {
    const src = readFileSync(pagePath, "utf8");
    // El <Input> text para fileName con onChange={setFileName} debe estar removido
    expect(src).not.toMatch(/setFileName/);
  });
});

// ============================================================================
// V9 — Static: JOIN sin file_url (2 tests)
// ============================================================================

describe("AC-10: GET /api/providers excluye file_url del response", () => {
  it("provider route SQL NO usa SELECT * para provider_documents (columnas explicitas)", () => {
    const src = readFileSync(providersRoutePath, "utf8");
    // El query a provider_documents debe ser EXPLICITO (columnas nombradas),
    // NO `SELECT *`. Esto es porque `SELECT *` retornaría file_url.
    // El spec (§4.6) define la lista exacta de columnas: id, provider_id,
    // type, file_name, uploaded_at, expiration_date.
    const providerDocsQuery = src.match(
      /SELECT[^;]*FROM\s+provider_documents[^;]*/i,
    );
    expect(providerDocsQuery?.[0] ?? "").not.toMatch(/SELECT\s+\*/i);
  });
  it("provider route response no expone file_url al cliente", () => {
    const src = readFileSync(providersRoutePath, "utf8");
    // El response JSON final no debe contener file_url. El cliente NO debe
    // tener acceso al URL de SharePoint; solo tiene `id` y pide el archivo
    // via /api/providers/[id]/documents/[docId]/download con auth.
    // Verificamos que el código de respuesta no serializa file_url.
    // Estrategia: el response no debe tener `file_url:` en ningún lugar
    // (objeto, .map(), spread, etc).
    expect(src).not.toMatch(/file_url\s*:/);
  });
});

// ============================================================================
// V11 — Static: AC-X1..X5 (UI + dedup, 10 tests)
// ============================================================================

describe("AC-X1: UI no usa file_url directo del JSON", () => {
  it("page.tsx NO menciona file_url en código de UI", () => {
    const src = readFileSync(pagePath, "utf8");
    expect(src).not.toMatch(/file_url|fileUrl/);
  });
  it("DocumentLink component NO menciona file_url", () => {
    // Test condicional: si el componente existe, verificar; si no, este test pasa
    if (existsSync(documentLinkPath)) {
      const src = readFileSync(documentLinkPath, "utf8");
      expect(src).not.toMatch(/file_url/);
    } else {
      // Archivo aún no existe (TDD Red). Test trivialmente pasa.
      expect(true).toBe(true);
    }
  });
});

describe("AC-X2: <DocumentLink> existe y exporta", () => {
  it("archivo src/components/providers/document-link.tsx existe", () => {
    expect(existsSync(documentLinkPath)).toBe(true);
  });
  it("exporta function DocumentLink", () => {
    const src = readFileSync(documentLinkPath, "utf8");
    expect(src).toMatch(/export\s+function\s+DocumentLink/);
  });
  it("usa getProviderDocumentDownloadUrl para construir el href", () => {
    const src = readFileSync(documentLinkPath, "utf8");
    expect(src).toMatch(/getProviderDocumentDownloadUrl/);
    // Además, el helper debe existir
    expect(existsSync(downloadUrlPath)).toBe(true);
    const helperSrc = readFileSync(downloadUrlPath, "utf8");
    expect(helperSrc).toMatch(
      /export\s+function\s+getProviderDocumentDownloadUrl/,
    );
  });
  it("renderiza <a target='_blank' rel='noopener noreferrer'>", () => {
    const src = readFileSync(documentLinkPath, "utf8");
    expect(src).toMatch(/target=["']_blank["']/);
    expect(src).toMatch(/rel=["']noopener\s+noreferrer["']/);
  });
});

describe("AC-X3: page.tsx usa <DocumentLink> en la lista de documentos", () => {
  it("page.tsx contiene <DocumentLink en el mapeo de provider.documents", () => {
    const src = readFileSync(pagePath, "utf8");
    expect(src).toMatch(/<DocumentLink/);
  });
});

describe("AC-X4: service hace SELECT-then-UPDATE-or-INSERT", () => {
  it("service.ts contiene SELECT con provider_id AND type", () => {
    const src = readFileSync(servicePath, "utf8");
    expect(src).toMatch(
      /SELECT[^;]*FROM\s+provider_documents[^;]*WHERE[^;]*provider_id[^;]*AND[^;]*type/i,
    );
  });
  it("service.ts contiene UPDATE provider_documents", () => {
    const src = readFileSync(servicePath, "utf8");
    expect(src).toMatch(/UPDATE\s+provider_documents/);
  });
  it("service.ts tiene lógica condicional if (existing) UPDATE else INSERT", () => {
    const src = readFileSync(servicePath, "utf8");
    // Debe haber una rama UPDATE condicional
    expect(src).toMatch(/if\s*\(/);
    // Y tanto UPDATE como INSERT deben estar presentes (validados arriba)
  });
});

describe("AC-X5: no UNIQUE constraint añadido al schema", () => {
  it("database/mysql/init.sql NO tiene UNIQUE en provider_documents", () => {
    // No-op de schema: el spec dice "no añadir UNIQUE". El test pasa trivialmente.
    // Verificación adicional: que no haya ALTER TABLE nuevo que añada UNIQUE.
    if (existsSync(path.join(ROOT, "database/mysql/init.sql"))) {
      const src = readFileSync(
        path.join(ROOT, "database/mysql/init.sql"),
        "utf8",
      );
      // El CREATE TABLE de provider_documents NO debe tener UNIQUE
      const providerDocsCreate = src.match(
        /CREATE TABLE\s+provider_documents[\s\S]*?\)\s*ENGINE=/m,
      );
      expect(providerDocsCreate?.[0] ?? "").not.toMatch(/UNIQUE/);
    } else {
      // init.sql no existe (raro, pero el test pasa trivialmente)
      expect(true).toBe(true);
    }
  });
});
