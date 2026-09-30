# Feature: Generación de documentos por módulo + archivo en SharePoint

> **Estado**: ⏳ Pending Review
> **Alcance**: Mínimo viable (10 plantillas, 1 biblioteca SharePoint, auth con client secret)
> **Fuera de alcance** (versiones futuras):
>
> - Búsqueda semántica / RAG sobre los documentos generados
> - Co-firma digital (DocuSign / Adobe Sign)
> - Versionado de plantillas (migración de cambios de campos)
> - Generación masiva en lote
> - Integración con OneDrive personal (solo SharePoint del sitio)

---

## 1. User Story

**As a** residente / gerente / director de obra,
**I want** que al registrar un anticipo, una OC, una OS, un corte, un contrato, una ausencia o un contrato laboral, la app me genere el formato oficial con los datos del registro ya diligenciados y lo guarde en la carpeta de SharePoint del proyecto correspondiente,
**So that** no tenga que descargar la plantilla, llenarla a mano, guardarla y subirla, eliminando reproceso y asegurando que todos los documentos quedan archivados en una sola ruta por proyecto.

---

## 2. Acceptance Criteria

### 2.1 Mapeo módulo → plantilla (matriz canónica)

| #   | Módulo / entidad                                        | Plantilla                                       | Convención de nombre en SharePoint                               |
| --- | ------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| 1   | `payments.concepto = "ANTICIPO"`                        | `3.2. AD-0033- SOLICITUD DE ANTICIPO.xlsx`      | `01-Anticipos/AD-0033_{PROY}_{AAAA-MM-DD}.xlsx`                  |
| 2   | `payments.concepto = "LEGALIZACION"`                    | `3.3. FORMATO DE LEGALIZACIÓN O REINTEGRO.xlsx` | `04-Legalizaciones/LEG_{PROY}_{AAAA-MM-DD}.xlsx`                 |
| 3   | `expenses.tipo = "COMPRA"`                              | `3.5. FORMATO OC_ ORDEN DE COMPRA.xlsx`         | `02-OC-OS/OC_{PROY}_{NUM}.xlsx`                                  |
| 4   | `expenses.tipo = "SERVICIO"`                            | `3.6. FORMATO OS_ ORDEN DE SERVICIO.xlsx`       | `02-OC-OS/OS_{PROY}_{NUM}.xlsx`                                  |
| 5   | `cuts` (al aprobar)                                     | `3.7. FORMATO DE CORTE Y MEMORIAS DE OBRA.xlsx` | `03-Cortes/CORTE_{PROY}_{NUM}_{AAAA-MM}.xlsx`                    |
| 6   | `work-logs.tipo = "AUSENCIA"`                           | `3.9. FORMATO AUSENCIA LABORAL[1].pdf`          | `05-Ausencias/AUS_{EMPLEADO}_{AAAA-MM-DD}.pdf`                   |
| 7   | `contracts.tipo = "OBRA" && pricingMode = "LUMP_SUM"`   | `V1-OBRA-PRECIO GLOBAL.docx`                    | `06-Contratos/Obra/CONT_{PROY}_{CONTRATISTA_SLUG}_GLOBAL.docx`   |
| 8   | `contracts.tipo = "OBRA" && pricingMode = "UNIT_PRICE"` | `V2-MODELO OBRA-PRECIO UNITARIO.docx`           | `06-Contratos/Obra/CONT_{PROY}_{CONTRATISTA_SLUG}_UNITARIO.docx` |
| 9   | `contracts.tipo = "DISENOS"`                            | `CONTRATO DISEÑOS.docx`                         | `06-Contratos/Disenos/CONT-DIS_{PROY}_{CLIENTE_SLUG}.docx`       |
| 10  | `employees` (al contratar)                              | `CONTRATO DE TRABAJO A TÉRMINO INDEFINIDO.docx` | `06-Contratos/Laboral/LAB_{EMPLEADO_SLUG}_{AAAA-MM-DD}.docx`     |

### 2.2 Criterios por capacidad

- [ ] **AC-GEN-1** — Existe un endpoint `POST /api/documents/generate` que recibe `{ entity, entityId }` y devuelve `{ webUrl, fileName, path, sizeBytes }`.
- [ ] **AC-GEN-2** — La generación es **idempotente**: si ya existe un archivo con el mismo nombre, se sube como nueva versión (no se duplica).
- [ ] **AC-GEN-3** — El documento generado preserva **fórmulas, estilos y formato** de la plantilla original (verificable leyendo de vuelta el xlsx).
- [ ] **AC-GEN-4** — Los placeholders docx usan sintaxis `{nombre_campo}` con `docxtemplater`; los xlsx se rellenan por **celda explícita** (no buscar-reemplazar ingenuo).
- [ ] **AC-GEN-5** — La **ruta SharePoint se resuelve** desde `projectId` de la entidad, con la jerarquía `Proyectos/{CODIGO}/{subcarpeta}/{archivo}`.
- [ ] **AC-GEN-6** — Si la carpeta del proyecto no existe, se **crea recursivamente** la primera vez (idempotente).
- [ ] **AC-GEN-7** — La UI muestra un **botón "Generar documento"** en: `payments`, `expenses`, `cuts`, `contracts`, `employees`, `work-logs` cuando aplique.
- [ ] **AC-GEN-8** — Al éxito, la UI muestra un **link directo** al archivo en SharePoint y persiste la URL en la entidad (`generatedDocumentUrl`).
- [ ] **AC-GEN-9** — Errores de SharePoint (401, 403, 404, 409, 5xx) devuelven códigos tipados al frontend; el usuario ve un mensaje accionable.
- [ ] **AC-GEN-10** — La operación de generar+subir se registra en un **log** (`document_generation_log`) con: `id, entity, entityId, fileName, sharepointPath, webUrl, status, errorCode, durationMs, userId, createdAt`.

### 2.3 Criterios de no-regresión

- [ ] **AC-NR-1** — Ningún endpoint CRUD existente (`/api/projects`, `/api/contracts`, etc.) se modifica; la generación es **aditiva**.
- [ ] **AC-NR-2** — Las 165 pruebas del suite actual siguen verdes después de la integración.
- [ ] **AC-NR-3** — Si SharePoint no está configurado (env vars faltantes), la app **arranca normal** y los endpoints `/api/documents/*` devuelven 503 con mensaje claro.

---

## 3. Edge Cases

### 3.1 Errores

| Caso                                                              | Comportamiento esperado                                           |
| ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| Faltan datos obligatorios en la entidad (ej. proyecto sin `code`) | `400 { error: "ENTITY_INCOMPLETE", missing: ["code"] }`           |
| Plantilla no encontrada en `/Formatos`                            | `500 { error: "TEMPLATE_MISSING", templateId: "AD-0033" }`        |
| `entity` o `entityId` no existen                                  | `404 { error: "ENTITY_NOT_FOUND" }`                               |
| SharePoint devuelve 401 (token expirado)                          | `503 { error: "SP_AUTH_FAILED", hint: "Rotar SP_CLIENT_SECRET" }` |
| SharePoint devuelve 403 (sin permisos)                            | `403 { error: "SP_FORBIDDEN" }`                                   |
| SharePoint devuelve 404 (sitio no existe)                         | `500 { error: "SP_SITE_NOT_FOUND" }`                              |
| Conflicto de nombre en upload                                     | **Versionar** (default) — el doc sube como nueva versión          |
| Network timeout (>30s al subir)                                   | Reintentar 1 vez; si falla, `504 { error: "SP_TIMEOUT" }`         |

### 3.2 Vacío

- Sin proyectos en BD → UI del selector de proyecto no muestra nada; el botón "Generar" queda disabled con tooltip.
- Sin SharePoint configurado → el botón "Generar" muestra un toast: "Funcionalidad no disponible: SharePoint no configurado".

### 3.3 Carga

- Durante la generación, el botón muestra spinner + texto "Generando y subiendo…".
- Polling innecesario: el endpoint es sincrónico y devuelve al terminar (esperado <5s para xlsx, <3s para docx).

---

## 4. Technical Contract

### 4.1 Nuevos tipos

```typescript
// src/types/documents.ts (NUEVO)
export type DocumentEntity =
  | "payments"
  | "expenses"
  | "cuts"
  | "contracts"
  | "employees"
  | "workLogs";

export type DocumentTemplateId =
  | "AD-0033" // anticipo
  | "LEG" // legalización
  | "OC"
  | "OS" // orden de compra / servicio
  | "CORTE" // corte de obra
  | "AUSENCIA" // ausencia laboral
  | "CONT_GLOBAL" // contrato obra precio global
  | "CONT_UNITARIO" // contrato obra precio unitario
  | "CONT_DISENOS" // contrato de diseños
  | "CONT_LABORAL"; // contrato laboral

export interface GenerateDocumentRequest {
  entity: DocumentEntity;
  entityId: string;
  templateId?: DocumentTemplateId; // opcional: si se omite, se infiere de la entidad
  fileNameOverride?: string; // opcional: solo ADMIN
}

export interface GenerateDocumentResponse {
  ok: true;
  webUrl: string; // link directo a SharePoint
  fileName: string;
  path: string; // ruta relativa en la biblioteca
  sizeBytes: number;
  version: number; // versión en SharePoint
  templateId: DocumentTemplateId;
  generatedAt: string; // ISO
}

export type GenerateDocumentError =
  | { error: "ENTITY_NOT_FOUND" }
  | { error: "ENTITY_INCOMPLETE"; missing: string[] }
  | { error: "TEMPLATE_MISSING"; templateId: string }
  | { error: "TEMPLATE_MISMATCH"; expected: DocumentTemplateId; got: string }
  | { error: "SP_AUTH_FAILED"; hint: string }
  | { error: "SP_FORBIDDEN" }
  | { error: "SP_SITE_NOT_FOUND" }
  | { error: "SP_TIMEOUT" }
  | { error: "RENDER_FAILED"; reason: string }
  | { error: "INTERNAL"; message: string };
```

### 4.2 Componentes

```typescript
// src/lib/document-generator/registry.ts
export function resolveTemplate(
  entity: DocumentEntity,
  entityRecord: unknown,
): DocumentTemplateId;

// src/lib/document-generator/render.ts
export async function renderDocument(
  templateId: DocumentTemplateId,
  data: Record<string, unknown>,
): Promise<Buffer>;

// src/lib/document-generator/fillers/<id>.ts (uno por plantilla)
export interface Filler<TData> {
  templateId: DocumentTemplateId;
  fill: (template: Buffer, data: TData) => Promise<Buffer>;
}

// src/lib/sharepoint/client.ts
export interface SharePointClient {
  ensureProjectFolder(projectCode: string): Promise<string>;
  uploadFile(args: {
    folderPath: string;
    fileName: string;
    content: Buffer;
  }): Promise<{ webUrl: string; sizeBytes: number; version: number }>;
}

// src/lib/sharepoint/paths.ts
export function buildProjectPath(
  projectCode: string,
  templateId: DocumentTemplateId,
  entityRecord: unknown,
): { folderPath: string; fileName: string };
```

### 4.3 API

```typescript
// POST /api/documents/generate
// Auth: requireRole("ADMIN","GERENTE","DIRECTOR","RESIDENTE")
// Body: GenerateDocumentRequest
// Resp 200: GenerateDocumentResponse
// Resp 4xx/5xx: GenerateDocumentError

// GET /api/documents/log?entity=...&entityId=...
// Auth: requireAuth
// Resp: DocumentGenerationLogEntry[]
```

### 4.4 Variables de entorno (nuevas)

```env
# .env.local (NUEVO — todas opcionales; sin ellas /api/documents/* devuelve 503)
SP_TENANT_ID=
SP_CLIENT_ID=
SP_CLIENT_SECRET=
SP_SITE_ID=                          # ID del sitio SharePoint (no la URL)
SP_DRIVE_ID=                         # ID de la biblioteca "Documentos"
SP_BASE_PATH="Proyectos"             # raíz dentro de la biblioteca
```

### 4.5 Esquema BD (nuevo)

```sql
-- database/mysql/migrations/006_document_generation.sql (NUEVO, idempotente)
CREATE TABLE IF NOT EXISTS document_generation_log (
  id              CHAR(36) PRIMARY KEY,
  entity          VARCHAR(32) NOT NULL,
  entity_id       CHAR(36) NOT NULL,
  template_id     VARCHAR(32) NOT NULL,
  file_name       VARCHAR(255) NOT NULL,
  sharepoint_path TEXT NOT NULL,
  web_url         TEXT NOT NULL,
  status          ENUM('OK','ERROR') NOT NULL,
  error_code      VARCHAR(64) NULL,
  duration_ms     INT UNSIGNED NOT NULL,
  user_id         CHAR(36) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_entity (entity, entity_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Columna en entidades para persistir el último doc generado
ALTER TABLE payments    ADD COLUMN IF NOT EXISTS generated_document_url TEXT NULL;
ALTER TABLE expenses    ADD COLUMN IF NOT EXISTS generated_document_url TEXT NULL;
ALTER TABLE cuts        ADD COLUMN IF NOT EXISTS generated_document_url TEXT NULL;
ALTER TABLE contracts   ADD COLUMN IF NOT EXISTS generated_document_url TEXT NULL;
ALTER TABLE employees   ADD COLUMN IF NOT EXISTS generated_document_url TEXT NULL;
ALTER TABLE work_logs   ADD COLUMN IF NOT EXISTS generated_document_url TEXT NULL;
```

### 4.6 Dependencias nuevas

```json
{
  "dependencies": {
    "docxtemplater": "^3.50.0",
    "pizzip": "^3.1.7",
    "@azure/msal-node": "^3.2.0",
    "@microsoft/microsoft-graph-client": "^3.0.7"
  },
  "devDependencies": {
    "@types/docxtemplater": "^0.0.8"
  }
}
```

> `xlsx` ya está en `^0.18.5` — se reutiliza para leer y preservar plantillas.

---

## 5. Dependencies

### 5.1 Archivos a crear

```
src/lib/document-generator/
  ├── registry.ts            ← resolveTemplate() + tabla entity→template
  ├── render.ts              ← dispatcher renderDocument()
  ├── fillers/
  │   ├── anticipo.ts        ← AD-0033
  │   ├── legalizacion.ts    ← LEG
  │   ├── oc.ts              ← OC
  │   ├── os.ts              ← OS
  │   ├── corte.ts           ← CORTE
  │   ├── ausencia.ts        ← AUSENCIA
  │   ├── contrato-global.ts
  │   ├── contrato-unitario.ts
  │   ├── contrato-disenos.ts
  │   └── contrato-laboral.ts
  ├── templates/             ← COPIA de los 9 archivos de /Formatos
  └── schema.ts              ← zod por filler

src/lib/sharepoint/
  ├── client.ts              ← SharePointClient (msal + graph)
  ├── paths.ts               ← buildProjectPath()
  └── auth.ts                ← MSAL confidential client

src/app/api/documents/
  ├── generate/route.ts
  └── log/route.ts

src/components/documents/
  ├── generate-button.tsx    ← botón reutilizable por módulo
  └── document-link.tsx      ← muestra link al archivo generado

src/types/documents.ts
database/mysql/migrations/006_document_generation.sql
```

### 5.2 Archivos a modificar

```
src/app/api/payments/route.ts    ← (NADA si solo exponemos el botón; ok add al GET)
src/app/api/expenses/route.ts    ← idem
src/app/api/cuts/route.ts        ← idem
src/app/api/contracts/route.ts   ← idem
src/app/api/employees/route.ts   ← idem
src/app/api/work-logs/route.ts   ← idem

src/components/payments/*.tsx    ← + <GenerateButton entity="payments" />
src/components/expenses/*.tsx    ← idem
src/components/cuts/*.tsx        ← idem
src/components/contracts/*.tsx   ← idem
src/components/employees/*.tsx   ← idem
src/components/work-logs/*.tsx   ← idem

src/lib/data-store.ts            ← exponer generatedDocumentUrl en colecciones
```

> **Importante**: ningún endpoint CRUD existente se rompe. Solo se añade el botón y un campo opcional en la respuesta.

### 5.3 Dependencias npm a instalar

```bash
npm install docxtemplater pizzip @azure/msal-node @microsoft/microsoft-graph-client
npm install -D @types/docxtemplater
```

---

## 6. Verifiers (TDD — rojo primero)

### 6.1 tests/verifiers/document-registry.spec.ts

- [ ] `resolveTemplate("payments", {concepto:"ANTICIPO"})` → `"AD-0033"`
- [ ] `resolveTemplate("payments", {concepto:"LEGALIZACION"})` → `"LEG"`
- [ ] `resolveTemplate("expenses", {tipo:"COMPRA"})` → `"OC"`
- [ ] `resolveTemplate("expenses", {tipo:"SERVICIO"})` → `"OS"`
- [ ] `resolveTemplate("contracts", {tipo:"OBRA",pricingMode:"LUMP_SUM"})` → `"CONT_GLOBAL"`
- [ ] `resolveTemplate("contracts", {tipo:"OBRA",pricingMode:"UNIT_PRICE"})` → `"CONT_UNITARIO"`
- [ ] `resolveTemplate("contracts", {tipo:"OBRA",pricingMode:"COST_PLUS"})` → throws `TEMPLATE_MISMATCH`
- [ ] `resolveTemplate("employees", {})` → `"CONT_LABORAL"`
- [ ] `resolveTemplate("workLogs", {tipo:"AUSENCIA"})` → `"AUSENCIA"`
- [ ] `resolveTemplate("cuts", {})` → `"CORTE"`
- [ ] `resolveTemplate("unknown", {})` → throws `TEMPLATE_MISSING`

### 6.2 tests/verifiers/filler-oc.spec.ts (xlsx)

- [ ] Carga `3.5. FORMATO OC_ ORDEN DE COMPRA.xlsx` real
- [ ] Rellena celdas: `B5=proveedor.nombre`, `B6=proveedor.nit`, `B10=items[0].descripcion`
- [ ] **Preserva fórmulas**: la celda `D20` (subtotal) mantiene `=SUM(D10:D19)`
- [ ] **Preserva estilos**: la celda del encabezado sigue en negrita
- [ ] Devuelve `Buffer` con `length > 0`
- [ ] Re-leyendo el buffer, los valores rellenados son correctos

### 6.3 tests/verifiers/filler-contrato-global.spec.ts (docx)

- [ ] Carga `V1-OBRA-PRECIO GLOBAL.docx` real
- [ ] Rellena `{nombre_proyecto}`, `{valor_global}`, `{plazo_meses}`, `{contratista_nombre}`
- [ ] Devuelve `Buffer` no vacío
- [ ] Re-leyendo el buffer, los placeholders están sustituidos

### 6.4 tests/verifiers/sharepoint-paths.spec.ts

- [ ] `buildProjectPath("PR-001", "OC", expense)` → `{folderPath:"Proyectos/PR-001/02-OC-OS", fileName:"OC_PR-001_0001.xlsx"}`
- [ ] `buildProjectPath("PR-002", "AD-0033", payment)` → `{folderPath:"Proyectos/PR-002/01-Anticipos", fileName:"AD-0033_PR-002_2026-09-29.xlsx"}`
- [ ] `buildProjectPath` con `projectCode` con caracteres raros → slug seguro (`PR-001/A` → `PR-001-A`)

### 6.5 tests/verifiers/sharepoint-client.spec.ts (con mock de Graph)

- [ ] `uploadFile` happy path → devuelve `{webUrl, sizeBytes, version:1}`
- [ ] `uploadFile` cuando ya existe → sube como v2, devuelve `version:2`
- [ ] `uploadFile` cuando Graph devuelve 401 → throws `SP_AUTH_FAILED`
- [ ] `ensureProjectFolder` cuando la carpeta no existe → la crea y la devuelve
- [ ] `ensureProjectFolder` cuando ya existe → no la duplica (idempotente)

### 6.6 tests/verifiers/document-api.spec.ts

- [ ] `POST /api/documents/generate` con `entity=payments, entityId=valid` → 200 con `webUrl`
- [ ] `POST /api/documents/generate` con `entityId=invalid` → 404
- [ ] `POST /api/documents/generate` con datos incompletos → 400
- [ ] `POST /api/documents/generate` sin env vars de SharePoint → 503
- [ ] `POST /api/documents/generate` con auth insuficiente → 401
- [ ] Cada generación exitosa crea un `document_generation_log` con `status=OK`

---

## 7. Out of Scope

- ❌ Búsqueda semántica (RAG) sobre documentos generados
- ❌ Co-firma digital / DocuSign
- ❌ Versionado de plantillas (cambios de campos a lo largo del tiempo)
- ❌ Generación en lote
- ❌ Integración con OneDrive personal
- ❌ Permisos granulares por carpeta de SharePoint (se usan los del sitio)
- ❌ Previsualización del documento en la UI (descarga directa)
- ❌ Re-generación con override de campos (v1 usa 100% datos de la entidad)

---

## 8. Implementation Plan (orden Karpathy)

1. **Red** — escribir los 6 spec files de verifier (deben fallar).
2. **Helpers** — `registry.ts` + `paths.ts` + zod schemas (verde los primeros 2 verifiers).
3. **Render xlsx** — `render.ts` + 1 filler de ejemplo (`oc.ts`) + verificación de fórmulas/estilos.
4. **Render docx** — `docxtemplater` wrapper + 1 filler de ejemplo (`contrato-global.ts`).
5. **Migración** — `006_document_generation.sql` + agregar columna `generated_document_url` a las 6 entidades.
6. **API** — `/api/documents/generate` + `/api/documents/log` (verifier API en verde).
7. **SharePoint client** — MSAL + Graph + mock test; los 10 fillers reales (los demás).
8. **UI** — `<GenerateButton>` + `<DocumentLink>`; integrar en 6 vistas.
9. **Refactor** — cualquier duplicación entre fillers, helpers compartidos.
10. **Verificación final** — `npx tsc --noEmit && npx vitest run` (165 + nuevos tests en verde).

---

## 9. Risks

| Riesgo                                                                                                       | Mitigación                                                                                               |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Plantillas reales tienen fórmulas/estilos que se rompen al regenerar                                         | Test "preserva fórmulas" con `xlsx` re-leyendo el output                                                 |
| Autenticación de SharePoint en app server (no browser) requiere tenant policy que permita client credentials | Documentar pre-requisito en setup; fallback a 503 con mensaje accionable                                 |
| Las 10 plantillas tienen versiones/formatos distintos (algunas con celdas combinadas, otras con tablas)      | Cada filler es su propio archivo aislado; un fallo no afecta a los demás                                 |
| `docxtemplater` no soporta tablas anidadas profundas                                                         | Revisar `CONTRATO DISEÑOS` y `V1-OBRA-PRECIO GLOBAL` antes del spec-final; si no, agregar post-procesado |
| `npm install` agrega 4 paquetes nuevos a `package.json` → impacta el lockfile                                | Hacerlo en commit aislado, validar que `npm run build` siga verde                                        |

---

## 10. Approval

**Status**: ⏳ Pending Review
**Decisiones default asumidas** (porque no estabas disponible para responder):

- Auth: App registration con client secret
- Biblioteca: nueva, convención `Proyectos/{CODIGO}/...`
- Trigger: manual (botón) por ahora
- Versionado: por nombre (SharePoint nativo)

Cuando vuelvas, confirma o ajusta estos 4 puntos antes de que ejecute el Plan de §8.
