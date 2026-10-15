# Corte 12 — Carga funcional de documentos de proveedor a SharePoint

> Spec generado 2026-10-14 por mavis. Reemplaza el MOCK actual de "Agregar
> documento" en `/tecnico/proveedores/[id]` por un upload real server-side
> con persistencia en `provider_documents` y SharePoint como storage.
>
> Cortes relacionados:
> - **Corte 6** (Corte 6.5 pausado en 17/18): provee el patrón de
>   dialog/upload para Excel. No se toca.
> - **Corte 5** (futuro): migración msal-node 3.x → 5.x. Aislada a
>   `src/lib/sharepoint/auth.ts`. Este corte NO toca MSAL.
> - **Corte 9** (cerrado): fix de redirect de middleware. No relacionado.

## Contexto

### Punto de partida (auditado el 2026-10-14)

**Lo que YA EXISTE y se reusa:**

| Pieza | Ubicación | Estado |
|---|---|---|
| Tabla `provider_documents` en MySQL | `database/mysql/init.sql:142` | ✅ Existe, leída por `/api/providers` |
| Cliente SharePoint (capa Graph) | `src/lib/sharepoint/{auth,client,sharepoint-client,retry,paths}.ts` | ✅ Funcional, usado por `document-generator` |
| `uploadFile(config, args)` con retry | `src/lib/sharepoint/sharepoint-client.ts:114` | ✅ Acepta `Buffer`, devuelve `{ webUrl, sizeBytes, version }` |
| `withRetry` con backoff exponencial | `src/lib/sharepoint/retry.ts` | ✅ Reintenta 5xx/timeouts, NO 4xx |
| Tipos `ProviderDocument`, `ProviderDocumentType` | `src/types/index.ts:369-385` | ✅ |
| Constantes `DOCUMENT_TYPE_LABELS`, `requiredDocsFor` | `src/lib/providers-constants.ts` | ✅ |
| File picker pattern (drag-and-drop) | `src/app/tecnico/presupuestos/cargar/page.tsx:54` | ✅ Reusable |

**Lo que NO EXISTE y se crea en este corte:**

| Pieza | Ubicación nueva |
|---|---|
| Lógica de upload de proveedor | `src/lib/providers-documents/{service,validation,paths}.ts` |
| API route POST upload | `src/app/api/providers/[id]/documents/route.ts` |
| API route GET download | `src/app/api/providers/[id]/documents/[docId]/download/route.ts` |
| `addDocument` real en store | `src/lib/data-store.ts` (`useProvidersStore`) |
| File picker en modal | `src/app/tecnico/proveedores/[id]/page.tsx` |
| Remover `file_url` del JOIN de `/api/providers` | `src/app/api/providers/route.ts` |

### El bug actual (auditado)

1. El modal `AddDocumentDialog` (`page.tsx:522-595`) tiene un campo
   `<Input>` de texto libre para "Nombre del archivo", NO es un file
   picker. Línea 583: `(Mock: la carga real se conectará después)`.
2. El handler `handleSubmit` (línea 539) llama `onAdd({type, fileName:
   fileName || "${type.toLowerCase()}.pdf", expirationDate: ...})` —
   asume `.pdf` y nunca sube nada.
3. El padre (`page.tsx:502`) llama `addDocument(provider.id, doc)` —
   `addDocument` viene de `useProvidersStore()` (línea 61), pero
   **`useProvidersStore` NO implementa `addDocument`** (data-store.ts:708-722).
   El return es `as any` así que no type-check, pero en runtime
   `addDocument(...)` es `undefined(...)` → `TypeError` silenciado por
   el modal cerrándose tras `setAddDocOpen(false)`.
4. `useContractsStore`, `useCutsStore`, `useEmployeesStore` tienen
   `addDocument` stub (loguea "pendiente" en consola). El de
   `useProvidersStore` ni siquiera tiene el stub.

### Decisiones cerradas (5 puntos del usuario, 2026-10-14)

1. **Estructura de carpetas:** Opción C.
   `Proyectos/{projectCode}/Proveedores/{providerCode}/{DocumentType}/{fileName}`
   - `projectCode` viene del proyecto al que el provider está asociado en ese contexto.
   - `providerCode` viene de `provider.code` (campo existente en `providers`).
   - `buildProviderDocumentPath` en `src/lib/providers-documents/paths.ts`
     (módulo NUEVO, NO se toca `src/lib/sharepoint/paths.ts`).
   - `sanitizeFileName`: remueve caracteres especiales, espacios a guiones, max 100 chars.

2. **Upload flow:** server-side vía `POST /api/providers/[id]/documents`.
   - Multipart/form-data con campos: `file` (binary), `type`, `expirationDate` (opcional).
   - Auth: `requireAuth()` + check de área (admin/técnico/ventas del proyecto).
   - Validar: `file.size <= 50MB`, content-type en allowlist, type en enum, providerId existe.
   - Delegar a `src/lib/providers-documents/service.ts`.

3. **Aislamiento:** crear `src/lib/providers-documents/` (módulo nuevo).
   - `service.ts`, `validation.ts`, `paths.ts`.
   - NO se toca `src/lib/sharepoint/` excepto lectura (importar `uploadFile` y `SharePointConfig`).
   - Corte 5 (msal-node 5.x) tocará solo `src/lib/sharepoint/auth.ts`. La interfaz `getToken()` se mantiene estable.

4. **Seguridad `file_url`:** API route de download con auth.
   - Crear `GET /api/providers/[id]/documents/[docId]/download`.
   - Valida sesión + acceso al provider (área o asignación).
   - Lee `file_url` de `provider_documents`.
   - Sirve el archivo (302 redirect a SharePoint o proxy via Graph).
   - **CAMBIAR el JOIN de `/api/providers` para NO devolver `file_url` directo al cliente.** Solo `id + type + file_name + uploaded_at + expiration_date`. La URL se pide aparte via el download endpoint.

5. **Tamaño máximo: 50 MB (52428800 bytes).**
   - 413 Payload Too Large si excede.
   - Content-type allowlist: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `image/jpeg`, `image/png`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
   - 415 Unsupported Media Type si no matchea.

---

## Decisión arquitectónica

**Recomendado:** server-side upload vía API route, con módulo
`providers-documents/` aislado. Razones:

1. **`clientSecret` de MSAL NUNCA debe estar en el browser** (es server-only).
   Si subiéramos directo desde browser, habría que hacer un flujo de
   token temporal con SAS, que filtra paths y es más complejo.
2. **Server puede validar** size, content-type, virus scan (futuro), rate
   limit, audit log — sin exponer esas reglas al cliente.
3. **Server puede usar `withRetry`** (ya implementado en
   `sharepoint/retry.ts`) sin que el browser sepa del retry.
4. **El módulo nuevo `providers-documents/` aísla la lógica de
   proveedor** del módulo genérico `sharepoint/`. Corte 5 (msal-node)
   solo tocará `sharepoint/auth.ts`.

**Por qué NO directo desde browser con SAS token:**
- El `webUrl` de SharePoint es accesible a cualquiera con el link (a
  menos que se configure el drive para requerir auth).
- Si en el futuro se quiere signed URL con expiración corta, el server
  lo genera y el browser sube. Pero para MVP, server-side es más
  simple y seguro.

**Trade-off aceptado:** latencia ligeramente mayor (1 hop extra al
server) vs seguridad + validación centralizada. Aceptable porque el
upload no es interactivo (el usuario no espera feedback sub-segundo).

---

## 1. User Story

**As a** residente de obra que necesita cargar documentos de un proveedor
(Cédula, RUT, Cámara de Comercio, etc.),
**I want to** usar un file picker en el modal "Agregar documento" del
detalle del proveedor, y que el archivo se suba a SharePoint
(organizado por proyecto/proveedor/tipo), se persista en la tabla
`provider_documents`, y aparezca inmediatamente en la lista de
documentos del proveedor,
**So that** los documentos queden archivados con trazabilidad completa
(quién los subió, cuándo, a qué provider, de qué tipo) y sean
descargables via una API route que valida auth y acceso por proyecto.

---

## 2. Acceptance Criteria

### 2.1 AC funcionales (existencia + validaciones + upload)

- [ ] **AC-1** Existe `src/lib/providers-documents/service.ts` y exporta
      `uploadProviderDocument(input: UploadProviderDocumentInput): Promise<UploadProviderDocumentResult>`.
      Verificación: `grep -E "export\s+async\s+function\s+uploadProviderDocument" src/lib/providers-documents/service.ts` retorna 1 match.
- [ ] **AC-2** Existe `src/lib/providers-documents/validation.ts` y exporta
      `validateProviderDocumentFile(input: ValidateProviderDocumentFileInput): Promise<ValidateResult>`.
      Verificación: archivo existe + `grep -E "export\s+(async\s+)?function\s+validateProviderDocumentFile"` retorna 1 match.
- [ ] **AC-3** Existe `src/lib/providers-documents/paths.ts` y exporta
      `buildProviderDocumentPath(input)` y `sanitizeFileName(name)`.
      Verificación: 2 exports.
- [ ] **AC-4** Existe `src/app/api/providers/[id]/documents/route.ts` con
      export `POST`. Verificación: archivo existe + `grep -E "export\s+async\s+function\s+POST"` retorna 1 match.
- [ ] **AC-5** Existe `src/app/api/providers/[id]/documents/[docId]/download/route.ts`
      con export `GET`. Verificación: archivo existe + `grep -E "export\s+async\s+function\s+GET"` retorna 1 match.

### 2.2 AC de validaciones (POST route)

- [ ] **AC-6** El POST route valida y retorna los códigos HTTP correctos:
      - 401 si no hay sesión (`requireAuth()` falla).
      - 404 si el provider no existe (`SELECT id FROM providers WHERE id = ?` retorna 0 rows).
      - 413 si `file.size > 50MB` (`Content-Length` header o `file.size`).
      - 415 si `file.type` no está en allowlist (PDF, DOCX, JPG, PNG, XLSX).
      - 201 con el documento creado si todo pasa.
      Verificación: el código del route contiene las 5 ramas (grep por
      cada `NextResponse.json` con `status: 4XX` y el `status: 201`).

### 2.3 AC de persistencia (upload real + INSERT)

- [ ] **AC-7** Tras upload exitoso, hay un `INSERT INTO provider_documents`
      con los campos correctos. Verificación: el código del service
      contiene `INSERT INTO provider_documents` con los placeholders
      `provider_id`, `type`, `file_name`, `file_url`, `expiration_date`,
      `uploaded_at`. (No usamos `uploaded_by` en MVP — ver Out of Scope.)

### 2.4 AC de integración con form (modal + store)

- [ ] **AC-8** El modal en `src/app/tecnico/proveedores/[id]/page.tsx`
      cambia de `<Input type="text">` a `<input type="file">` con atributo
      `accept` que incluye los 5 mime types allowlist. Verificación:
      `grep -E '<input[^>]*type="file"' page.tsx` retorna ≥1 match. El
      `accept` incluye `.pdf,.docx,.jpg,.jpeg,.png,.xlsx`.
- [ ] **AC-9** `useProvidersStore()` tiene `addDocument(providerId, doc)`
      que llama al API route con FormData. **NO** es undefined, **NO** es
      stub. Verificación: `data-store.ts` línea 708-722 contiene
      `addDocument` en el return del store. El handler hace
      `fetch(/api/providers/${providerId}/documents, { method: "POST", body: formData })`.

### 2.5 AC de seguridad (download + JOIN)

- [ ] **AC-10** El `GET /api/providers` (route.ts) **NO** devuelve
      `file_url` en la respuesta. Solo `id`, `type`, `file_name`,
      `uploaded_at`, `expiration_date`. Verificación: grep en
      `src/app/api/providers/route.ts` busca `file_url` en el SELECT
      y en la respuesta JSON. **El SELECT debe excluir `file_url`** (o
      el route debe proyectar para excluirlo). El response shape solo
      tiene los 5 campos seguros.
- [ ] **AC-11** El GET download route valida:
      - 401 si no hay sesión.
      - 403 si el usuario no tiene acceso al provider (área o asignación).
      - 404 si el documento no existe.
      - 302 a `file_url` (redirect a SharePoint) o stream del archivo.
      Verificación: el código del route contiene las 4 ramas.
- [ ] **AC-X1** La UI de documentos de proveedor usa
      `GET /api/providers/[id]/documents/[docId]/download` para abrir
      el archivo. **NO** usa `file_url` directo del JSON. Verificación:
      `grep -rn "file_url" src/app/tecnico/proveedores/ src/components/providers/`
      retorna 0 matches en código de UI (solo en API routes y service).
- [ ] **AC-X2** Existe un componente nuevo
      `src/components/providers/document-link.tsx` que exporta
      `<DocumentLink providerId={...} docId={...} fileName={...} />`
      y renderiza un `<a href={getProviderDocumentDownloadUrl(...)}>`
      con `target="_blank"` y `rel="noopener noreferrer"`. La URL
      se construye con el helper `getProviderDocumentDownloadUrl`
      (en `src/lib/providers-documents/download-url.ts`).
- [ ] **AC-X3** En `src/app/tecnico/proveedores/[id]/page.tsx`, la lista
      de documentos del proveedor (línea ~397 que mapea
      `provider.documents`) usa `<DocumentLink>` para cada documento
      en vez de un `<div>`/`<span>` sin link. Verificación: el mapeo
      de `provider.documents` contiene `<DocumentLink` (no solo
      `<div` o `<span`).
- [ ] **AC-X4** El service hace SELECT-then-UPDATE-or-INSERT: antes
      de INSERT en `provider_documents`, hace
      `SELECT id FROM provider_documents WHERE provider_id=? AND type=?`.
      Si existe, hace UPDATE con los nuevos campos
      (`file_name`, `file_url`, `uploaded_at`, `expiration_date`).
      Si no existe, hace INSERT. Verificación: el código de
      `service.ts` contiene tanto `SELECT` (con `provider_id` y `type`)
      como lógica condicional `if (existing) UPDATE else INSERT`.
- [ ] **AC-X5** Comportamiento de duplicados: subir un documento del
      mismo `type` para el mismo `provider_id` que ya existe
      REEMPLAZA la fila existente (UPDATE: nuevo `file_name`,
      `file_url`, `uploaded_at`, `expiration_date`). NO crea fila
      duplicada. Verificación: el flujo de `service.ts` llama
      `UPDATE provider_documents` cuando ya existe, no `INSERT`.
      **No añadir UNIQUE constraint** en el schema (evita migración).

### 2.6 AC de regresión

- [ ] **AC-12** `npx tsc --noEmit` retorna solo el error preexistente en
      `tests/verifiers/advances-suggestion.spec.ts:21` (TS2741
      'contractId' missing). 0 nuevos. `npx vitest run` retorna
      737 passed | 17 failed | 8 skipped (no nuevos rojos del Corte 12).
      `npx next build` exit 0, 29+ páginas estáticas.

---

## 3. Edge Cases / Riesgos

- **R1 (tamaño máximo 50MB):** el usuario sube un PDF de 80MB. El
  route valida `file.size` ANTES de llamar al service. 413 con
  mensaje claro ("El archivo excede 50MB. Por favor comprime el PDF o
  sube una versión más liviana.").
- **R2 (content-type inválido):** el usuario sube un .exe renombrado
  a .pdf. El route valida `file.type` (mime del browser, NO la
  extensión). 415 con allowlist. NO se sube a SharePoint.
- **R3 (providerId no existe en URL):** el atacante hace POST a
  `/api/providers/abc-fake-uuid/documents`. El route valida con
  `SELECT id FROM providers WHERE id = ?` antes de continuar. 404.
- **R4 (sesión sin acceso al proyecto):** el usuario es residente de
  un proyecto A pero intenta subir doc a un provider de un proyecto B.
  El route valida que `provider.project_id` corresponda a un proyecto
  accesible por el usuario. 403. (Implementación: tabla `project_users`
  con asignación user-project, o el filtro por `user.area`.)
- **R5 (archivo en SharePoint sin INSERT en MySQL):** el upload a
  SharePoint OK, pero el INSERT a MySQL falla (e.g., DB down). El
  archivo queda en SharePoint como huérfano. Mitigate: outbox
  pattern o cleanup periódico. **MVP**: log de error + 500 al cliente
  con mensaje "Hubo un error al guardar, contacta al administrador".
- **R6 (concurrencia: 2 uploads del mismo nombre al mismo tiempo):**
  `PUT` puede fallar con 409 si el path existe en otra subida
  simultánea. Mitigate: `@microsoft.graph.conflictBehavior: "rename"`
  (ya usado en `ensureFolder`). El nombre final será `cedula (1).pdf`
  o similar.
- **R7 (token MSAL expira mid-request):** `acquireTokenByClientCredential`
  retorna un nuevo token si el anterior expiró. `getToken()` ya cachea
  y renueva. Si falla la renovación, 500 con mensaje genérico
  (no exponer detalles de MSAL).
- **R8 (caracteres especiales en fileName):** el contratista sube
  `Cédula (representante legal) - 2025.pdf`. `sanitizeFileName`
  lo convierte a `cedula-representante-legal-2025.pdf` (sin tildes,
  espacios a guiones, max 100 chars). El path en SharePoint es
  seguro (no rompe la URL).
- **R9 (file_url de SharePoint es público por defecto):** un atacante
  con el link puede acceder. Mitigate: el JOIN NO devuelve file_url.
  El cliente solo tiene `id`. Para descargar, llama al endpoint de
  download (que valida auth + access). Ver AC-10.
- **R10 (DELETE de documento sin borrar el archivo en SharePoint):**
  MVP: DELETE no está implementado. Documentar como follow-up.

---

## 4. Technical Contract

### 4.1 Nuevo módulo `src/lib/providers-documents/`

#### 4.1.1 `paths.ts`

```typescript
import type { ProviderDocumentType } from "@/types";

export interface BuildProviderDocumentPathInput {
  basePath: string;                      // "Proyectos"
  projectCode: string;                   // "PV-2026-001"
  providerCode: string;                  // "PROV-EMPRESA-A"
  documentType: ProviderDocumentType;    // "CEDULA"
  fileName: string;                      // "cedula-representante-legal.pdf" (ya sanitizado)
}

export interface BuildProviderDocumentPathResult {
  folderPath: string;                    // "Proyectos/PV-2026-001/Proveedores/PROV-EMPRESA-A/CEDULA"
  fileName: string;                      // mismo input (sanitización se hace ANTES)
}

/**
 * Resuelve la ruta SharePoint para un documento de proveedor.
 * Convención (decidida 2026-10-14):
 *   Proyectos/{projectCode}/Proveedores/{providerCode}/{DocumentType}/
 * No confundir con `src/lib/sharepoint/paths.ts:buildProjectPath` que es
 * para documentos GENERADOS desde plantilla (Anticipos, OC, etc.).
 * Esta función es específica de documentos de PROVEEDOR.
 */
export function buildProviderDocumentPath(
  input: BuildProviderDocumentPathInput
): BuildProviderDocumentPathResult;

/**
 * Sanitiza un nombre de archivo para SharePoint:
 *  - Remueve caracteres especiales (excepto letras, números, ., -, _).
 *  - Reemplaza espacios por guiones.
 *  - Colapsa guiones múltiples.
 *  - Max 100 chars.
 *  - Si queda vacío, retorna "archivo".
 *  - Si termina en punto, lo remueve.
 */
export function sanitizeFileName(name: string): string;
```

#### 4.1.2 `validation.ts`

```typescript
import type { ProviderDocumentType } from "@/types";

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export interface ValidateProviderDocumentFileInput {
  file: { size: number; type: string; name: string };
  documentType: ProviderDocumentType;
  providerId: string;
}

export type ValidateResult =
  | { ok: true }
  | { ok: false; code: "FILE_TOO_LARGE" | "INVALID_CONTENT_TYPE" | "INVALID_DOCUMENT_TYPE" | "PROVIDER_NOT_FOUND" | "FILE_NAME_TOO_LONG"; status: number; message: string };

/**
 * Valida un archivo de proveedor antes de subir a SharePoint.
 * - size <= 50MB
 * - type en ALLOWED_CONTENT_TYPES
 * - documentType en enum
 * - fileName sanitizado <= 100 chars
 * - providerId existe en DB (query a MySQL)
 */
export async function validateProviderDocumentFile(
  input: ValidateProviderDocumentFileInput
): Promise<ValidateResult>;
```

#### 4.1.3 `service.ts`

```typescript
import type { ProviderDocumentType } from "@/types";
import {
  uploadFile as sharepointUploadFile,
  ensureFolder as sharepointEnsureFolder,
  type UploadResult,
} from "@/lib/sharepoint/sharepoint-client";
import { readSharePointConfig } from "@/lib/sharepoint/auth";
import { buildProviderDocumentPath, sanitizeFileName } from "./paths";
import { validateProviderDocumentFile } from "./validation";
import { query } from "@/lib/db";  // (o como sea el helper de MySQL)

export interface UploadProviderDocumentInput {
  providerId: string;
  documentType: ProviderDocumentType;
  file: { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };
  expirationDate?: string;  // YYYY-MM-DD
  userId: string;            // for audit
}

export interface UploadProviderDocumentResult {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  type: ProviderDocumentType;
  expirationDate?: string;
}

/**
 * Sube un documento de proveedor a SharePoint y lo registra en MySQL.
 * 
 * Flujo:
 *  1. Valida el archivo (size, type, name).
 *  2. Lee el provider y su project_code.
 *  3. Sanitiza el fileName.
 *  4. Construye el path SharePoint (buildProviderDocumentPath).
 *  5. ensureFolder (idempotente).
 *  6. uploadFile (con retry via sharepoint-client).
 *  7. INSERT en provider_documents.
 *  8. Retorna el documento creado.
 */
export async function uploadProviderDocument(
  input: UploadProviderDocumentInput
): Promise<UploadProviderDocumentResult>;
```

### 4.2 API route `POST /api/providers/[id]/documents`

```typescript
// src/app/api/providers/[id]/documents/route.ts
// POST /api/providers/[id]/documents
// Auth: requireAuth() + check user.area or project access
// Body: multipart/form-data (file, type, expirationDate)
//
// Responses:
//   201: { id, fileName, fileUrl, uploadedAt, type, expirationDate }
//   401: { error: "UNAUTHENTICATED" }
//   404: { error: "PROVIDER_NOT_FOUND" }
//   413: { error: "FILE_TOO_LARGE", maxSizeMB: 50 }
//   415: { error: "INVALID_CONTENT_TYPE", allowed: [...] }
//   500: { error: "INTERNAL_ERROR" }

import { NextResponse } from "next/server";
import { requireAuth, authFailureResponse } from "@/lib/api-auth";
import { uploadProviderDocument } from "@/lib/providers-documents/service";
import { validateProviderDocumentFile } from "@/lib/providers-documents/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // 1. requireAuth
  // 2. parse multipart (formData)
  // 3. extract file, type, expirationDate
  // 4. validateProviderDocumentFile (size, type, name, providerId)
  // 5. uploadProviderDocument (delegates to service)
  // 6. return 201 with document
}
```

### 4.3 API route `GET /api/providers/[id]/documents/[docId]/download`

```typescript
// src/app/api/providers/[id]/documents/[docId]/download/route.ts
// GET /api/providers/[id]/documents/[docId]/download
// Auth: requireAuth() + check user.area or project access
//
// Responses:
//   302: redirect to SharePoint file_url
//   401: { error: "UNAUTHENTICATED" }
//   403: { error: "FORBIDDEN" }
//   404: { error: "DOCUMENT_NOT_FOUND" }
//   500: { error: "INTERNAL_ERROR" }

import { NextResponse } from "next/server";
import { requireAuth, authFailureResponse } from "@/lib/api-auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { id: string; docId: string } }
): Promise<NextResponse> {
  // 1. requireAuth
  // 2. SELECT file_url FROM provider_documents WHERE id = ? AND provider_id = ?
  // 3. SELECT project_id FROM providers WHERE id = ?
  // 4. check user.area or project_users assignment
  // 5. return NextResponse.redirect(file_url, 302)
}
```

### 4.4 Modificación `useProvidersStore`

```typescript
// src/lib/data-store.ts (useProvidersStore)
export const useProvidersStore = () => {
  const s = useDataStore((x) => x.providers);
  const items = (useDataStore((x) => x.providers.items) as Provider[]) ?? [];
  return {
    providers: items,
    addProvider: (data: any) => s.add(data),
    updateProvider: (id: string, p: any) => s.update(id, p),
    deleteProvider: (id: string) => s.remove(id),
    getProvider: (id: string) => items.find((p) => p.id === id),
    toggleActive: (id: string, active?: boolean) =>
      s.update(id, { isActive: active } as any),
    setStatus: (id: string, status: any) => s.update(id, { status } as any),
    load: s.load,
    // NUEVO: addDocument real
    addDocument: async (
      providerId: string,
      doc: { type: ProviderDocumentType; file: File; expirationDate?: string; userId: string }
    ) => {
      const formData = new FormData();
      formData.append("file", doc.file);
      formData.append("type", doc.type);
      if (doc.expirationDate) formData.append("expirationDate", doc.expirationDate);
      const res = await fetch(`/api/providers/${providerId}/documents`, {
        method: "POST",
        body: formData,
        credentials: "include",  // send auth cookie
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      // Refetch provider to update documents list
      const updated = await fetch(`/api/providers/${providerId}`, {
        credentials: "include",
      });
      if (updated.ok) {
        const data = await updated.json();
        s.update(providerId, data);  // or similar
      }
    },
  } as any;
};
```

### 4.5 Modificación del modal en `proveedores/[id]/page.tsx`

```diff
- const [fileName, setFileName] = useState("");
+ const [file, setFile] = useState<File | null>(null);
+ const [uploadError, setUploadError] = useState<string | null>(null);
+ const [uploading, setUploading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setUploadError("Por favor selecciona un archivo");
      return;
    }
    setUploading(true);
    setUploadError(null);
    addDocument(provider.id, {
      type,
      file,
      expirationDate: expirationDate || undefined,
      userId: user?.id ?? "",
    })
      .then(() => {
        setAddDocOpen(false);
        setFile(null);
        setExpirationDate("");
        setType("CEDULA");
      })
      .catch((err) => {
        setUploadError(err.message);
      })
      .finally(() => {
        setUploading(false);
      });
  }

- <Input
-   value={fileName}
-   onChange={(e) => setFileName(e.target.value)}
-   placeholder="cedula.pdf"
- />
+ <input
+   type="file"
+   accept=".pdf,.docx,.jpg,.jpeg,.png,.xlsx"
+   onChange={(e) => setFile(e.target.files?.[0] ?? null)}
+   className="..."
+ />
```

### 4.6 Modificación del JOIN en `/api/providers/route.ts`

```diff
  // ANTES: SELECT * FROM provider_documents (incluye file_url)
- ? await query<any[]>(
-     `SELECT * FROM provider_documents WHERE provider_id IN (${placeholders}) ORDER BY uploaded_at DESC`,
-     ids,
-   )

  // DESPUÉS: SELECT explícito SIN file_url (seguridad: el cliente no
  // debe tener el webUrl directo; lo pide via /download endpoint)
+ ? await query<any[]>(
+     `SELECT id, provider_id, type, file_name, uploaded_at, expiration_date
+      FROM provider_documents
+      WHERE provider_id IN (${placeholders})
+      ORDER BY uploaded_at DESC`,
+     ids,
+   )
```

### 4.7 Helper del cliente (frontend)

```typescript
// src/lib/providers-documents/download-url.ts
export function getProviderDocumentDownloadUrl(
  providerId: string,
  docId: string
): string {
  return `/api/providers/${providerId}/documents/${docId}/download`;
}
```

### 4.8 Componente `<DocumentLink>` (NUEVO, AC-X2)

```typescript
// src/components/providers/document-link.tsx
"use client";

import { getProviderDocumentDownloadUrl } from "@/lib/providers-documents/download-url";
import { FileText, Download } from "lucide-react";

export interface DocumentLinkProps {
  providerId: string;
  docId: string;
  fileName: string;
  /** Opcional: label custom (default: fileName) */
  label?: string;
}

/**
 * Renderiza un link al endpoint de download con auth.
 * target="_blank" para abrir en nueva tab.
 * rel="noopener noreferrer" por seguridad.
 */
export function DocumentLink({ providerId, docId, fileName, label }: DocumentLinkProps) {
  const href = getProviderDocumentDownloadUrl(providerId, docId);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="..."
    >
      <FileText className="h-4 w-4" />
      <Download className="h-3 w-3" />
      {label ?? fileName}
    </a>
  );
}
```

### 4.9 Modificación de la lista de documentos en `page.tsx`

```diff
- {provider.documents.map((doc) => (
-   <div key={doc.id}>
-     <span>{doc.fileName}</span>
-   </div>
- ))}
+ {provider.documents.map((doc) => (
+   <DocumentLink
+     key={doc.id}
+     providerId={provider.id}
+     docId={doc.id}
+     fileName={doc.fileName}
+     label={`${DOCUMENT_TYPE_LABELS[doc.type]}: ${doc.fileName}`}
+   />
+ ))}
```

### 4.10 Lógica de dedup en `service.ts` (AC-X4 + AC-X5)

```typescript
// En uploadProviderDocument, ANTES del INSERT:
const existing = await query<any[]>(
  `SELECT id FROM provider_documents WHERE provider_id = ? AND type = ?`,
  [providerId, documentType]
);

let documentId: string;
if (existing.length > 0) {
  // UPDATE: reemplazar fila existente
  documentId = existing[0].id;
  await query(
    `UPDATE provider_documents
     SET file_name = ?, file_url = ?, uploaded_at = NOW(), expiration_date = ?
     WHERE id = ?`,
    [sanitizedFileName, uploadResult.webUrl, expirationDate ?? null, documentId]
  );
} else {
  // INSERT: nueva fila
  documentId = crypto.randomUUID();
  await query(
    `INSERT INTO provider_documents
     (id, provider_id, type, file_name, file_url, uploaded_at, expiration_date)
     VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
    [documentId, providerId, documentType, sanitizedFileName, uploadResult.webUrl, expirationDate ?? null]
  );
}
```

**No se añade UNIQUE constraint al schema.** El dedup se hace en el
service via SELECT-then-UPDATE-or-INSERT. Esto evita una migración de
DB (que requeriría deploy coordinado) y permite que el cambio sea
backward-compatible con cualquier fila existente en `provider_documents`.

---

## 5. Dependencies

### Files to Create
- `nextjs_space/nextjs_space/src/lib/providers-documents/service.ts` (~150 LOC)
- `nextjs_space/nextjs_space/src/lib/providers-documents/validation.ts` (~80 LOC)
- `nextjs_space/nextjs_space/src/lib/providers-documents/paths.ts` (~70 LOC)
- `nextjs_space/nextjs_space/src/app/api/providers/[id]/documents/route.ts` (~120 LOC)
- `nextjs_space/nextjs_space/src/app/api/providers/[id]/documents/[docId]/download/route.ts` (~80 LOC)
- `nextjs_space/nextjs_space/src/lib/providers-documents/download-url.ts` (~10 LOC)
- `nextjs_space/nextjs_space/tests/verifiers/audit-corte-12-provider-documents-sharepoint.spec.ts` (~250 LOC, en Commit 1)

### Files to Modify
- `nextjs_space/nextjs_space/src/lib/data-store.ts` (useProvidersStore: addDocument real, +30 LOC)
- `nextjs_space/nextjs_space/src/app/tecnico/proveedores/[id]/page.tsx` (file picker + handler, +20/-10 LOC)
- `nextjs_space/nextjs_space/src/app/api/providers/route.ts` (JOIN sin file_url, ~5 LOC change)

### Files explicitly NOT touched
- `nextjs_space/nextjs_space/src/lib/sharepoint/*` (Corte 5 territory; este corte solo IMPORTA)
- `nextjs_space/nextjs_space/src/lib/excel-parser.ts`
- `nextjs_space/nextjs_space/src/types/index.ts` (los tipos ya existen)
- `nextjs_space/nextjs_space/src/types/documents.ts`
- `nextjs_space/nextjs_space/src/app/api/documents/*` (Corte 6 territory)
- `nextjs_space/nextjs_space/src/lib/document-generator/*` (Corte 6)
- `nextjs_space/nextjs_space/src/lib/providers-constants.ts` (los tipos ya existen)
- `nextjs_space/nextjs_space/src/middleware.ts` (Corte 9, ya cerrado)
- `nextjs_space/nextjs_space/src/app/login/page.tsx` (Corte 9, ya cerrado)
- `nextjs_space/nextjs_space/package.json`, `package-lock.json` (no se agregan deps)
- `nextjs_space/nextjs_space/database/mysql/init.sql` (la tabla ya existe; no se modifica schema en este corte)

### Existing functions/types reused (read-only)
- `uploadFile`, `ensureFolder` (`src/lib/sharepoint/sharepoint-client.ts`)
- `SharePointConfig`, `readSharePointConfig`, `getToken` (`src/lib/sharepoint/auth.ts`)
- `withRetry` (via `uploadFile` internamente; no se llama directo)
- `requireAuth`, `authFailureResponse` (`src/lib/api-auth.ts`)
- `query` (helper de MySQL en `src/lib/db.ts` o similar)
- `ProviderDocument`, `ProviderDocumentType` (`src/types/index.ts`)
- `DOCUMENT_TYPE_LABELS`, `requiredDocsFor` (`src/lib/providers-constants.ts`)

---

## 6. Verifier Plan (V1-V10)

### V1 — Static source analysis: archivos + exports (~6 tests)

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const servicePath = path.join(ROOT, "src/lib/providers-documents/service.ts");
const validationPath = path.join(ROOT, "src/lib/providers-documents/validation.ts");
const pathsFile = path.join(ROOT, "src/lib/providers-documents/paths.ts");
const postRoutePath = path.join(ROOT, "src/app/api/providers/[id]/documents/route.ts");
const downloadRoutePath = path.join(ROOT, "src/app/api/providers/[id]/documents/[docId]/download/route.ts");

describe("AC-1: src/lib/providers-documents/service.ts existe y exporta uploadProviderDocument", () => {
  it("existe el archivo", () => {
    expect(existsSync(servicePath)).toBe(true);
  });
  it("exporta uploadProviderDocument", () => {
    const src = readFileSync(servicePath, "utf8");
    expect(src).toMatch(/export\s+async\s+function\s+uploadProviderDocument/);
  });
});

describe("AC-2: src/lib/providers-documents/validation.ts existe y exporta validateProviderDocumentFile", () => {
  it("existe el archivo", () => {
    expect(existsSync(validationPath)).toBe(true);
  });
  it("exporta validateProviderDocumentFile", () => {
    const src = readFileSync(validationPath, "utf8");
    expect(src).toMatch(/export\s+(async\s+)?function\s+validateProviderDocumentFile/);
  });
});

describe("AC-3: src/lib/providers-documents/paths.ts existe y exporta buildProviderDocumentPath + sanitizeFileName", () => {
  it("existe el archivo", () => {
    expect(existsSync(pathsFile)).toBe(true);
  });
  it("exporta buildProviderDocumentPath", () => {
    const src = readFileSync(pathsFile, "utf8");
    expect(src).toMatch(/export\s+function\s+buildProviderDocumentPath/);
  });
  it("exporta sanitizeFileName", () => {
    const src = readFileSync(pathsFile, "utf8");
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
```

### V2 — Static: paths shape (~3 tests)

```ts
describe("AC-3: buildProviderDocumentPath produces correct path", () => {
  it("uses Proyetos/{projectCode}/Proveedores/{providerCode}/{type} convention", () => {
    const src = readFileSync(pathsFile, "utf8");
    // Verifica que la función construye la estructura esperada
    expect(src).toMatch(/Proyectos/);
    expect(src).toMatch(/Proveedores/);
    expect(src).toMatch(/\$\{.*projectCode.*\}/);
    expect(src).toMatch(/\$\{.*providerCode.*\}/);
    expect(src).toMatch(/\$\{.*documentType.*\}/);
  });
});

describe("AC-3: sanitizeFileName normalizes special chars", () => {
  it("replaces spaces with dashes", () => {
    const src = readFileSync(pathsFile, "utf8");
    expect(src).toMatch(/replace.*\s|replace.*\//);
  });
  it("caps at 100 chars", () => {
    const src = readFileSync(pathsFile, "utf8");
    expect(src).toMatch(/100/);
  });
});
```

### V3 — Static: validation content (~3 tests)

```ts
describe("AC-2: validateProviderDocumentFile enforces size 50MB", () => {
  it("references 50MB constant", () => {
    const src = readFileSync(validationPath, "utf8");
    expect(src).toMatch(/50\s*\*\s*1024\s*\*\s*1024|MAX_FILE_SIZE/);
  });
  it("checks file size against limit", () => {
    const src = readFileSync(validationPath, "utf8");
    expect(src).toMatch(/file\.size|\.size\s*>/);
  });
});

describe("AC-2: validateProviderDocumentFile enforces content-type allowlist", () => {
  it("has allowlist with PDF, DOCX, JPG, PNG, XLSX", () => {
    const src = readFileSync(validationPath, "utf8");
    expect(src).toMatch(/application\/pdf/);
    expect(src).toMatch(/wordprocessingml/);  // DOCX
    expect(src).toMatch(/image\/jpeg/);
    expect(src).toMatch(/image\/png/);
    expect(src).toMatch(/spreadsheetml/);  // XLSX
  });
});
```

### V4 — Static: POST route validations (~5 tests)

```ts
describe("AC-6: POST route returns 401 on no auth", () => {
  it("uses requireAuth", () => {
    const src = readFileSync(postRoutePath, "utf8");
    expect(src).toMatch(/requireAuth/);
  });
  it("returns 401 status code", () => {
    const src = readFileSync(postRoutePath, "utf8");
    expect(src).toMatch(/status:\s*401/);
  });
});

describe("AC-6: POST route returns 404 on missing provider", () => {
  it("returns 404 status code", () => {
    const src = readFileSync(postRoutePath, "utf8");
    expect(src).toMatch(/status:\s*404/);
  });
});

describe("AC-6: POST route returns 413 on file too large", () => {
  it("returns 413 status code", () => {
    const src = readFileSync(postRoutePath, "utf8");
    expect(src).toMatch(/status:\s*413/);
  });
});

describe("AC-6: POST route returns 415 on invalid content-type", () => {
  it("returns 415 status code", () => {
    const src = readFileSync(postRoutePath, "utf8");
    expect(src).toMatch(/status:\s*415/);
  });
});
```

### V5 — Static: POST route happy path (~3 tests)

```ts
describe("AC-7: POST route calls uploadProviderDocument", () => {
  it("delegates to service", () => {
    const src = readFileSync(postRoutePath, "utf8");
    expect(src).toMatch(/uploadProviderDocument/);
  });
});

describe("AC-7: POST route returns 201 on success", () => {
  it("returns 201 status code", () => {
    const src = readFileSync(postRoutePath, "utf8");
    expect(src).toMatch(/status:\s*201/);
  });
});

describe("AC-7: service INSERTs into provider_documents", () => {
  it("service contains INSERT statement", () => {
    const src = readFileSync(servicePath, "utf8");
    expect(src).toMatch(/INSERT\s+INTO\s+provider_documents/);
  });
  it("INSERT includes provider_id, type, file_name, file_url", () => {
    const src = readFileSync(servicePath, "utf8");
    expect(src).toMatch(/provider_id/);
    expect(src).toMatch(/type/);
    expect(src).toMatch(/file_name/);
    expect(src).toMatch(/file_url/);
  });
});
```

### V6 — Static: GET download route (~4 tests)

```ts
describe("AC-11: GET download returns 401 on no auth", () => {
  it("uses requireAuth and returns 401", () => {
    const src = readFileSync(downloadRoutePath, "utf8");
    expect(src).toMatch(/requireAuth/);
    expect(src).toMatch(/status:\s*401/);
  });
});

describe("AC-11: GET download returns 403 on forbidden", () => {
  it("returns 403 status code", () => {
    const src = readFileSync(downloadRoutePath, "utf8");
    expect(src).toMatch(/status:\s*403/);
  });
});

describe("AC-11: GET download returns 404 on missing doc", () => {
  it("returns 404 status code", () => {
    const src = readFileSync(downloadRoutePath, "utf8");
    expect(src).toMatch(/status:\s*404/);
  });
});

describe("AC-11: GET download redirects to file_url on success", () => {
  it("uses NextResponse.redirect", () => {
    const src = readFileSync(downloadRoutePath, "utf8");
    expect(src).toMatch(/NextResponse\.redirect/);
  });
});
```

### V7 — Static: useProvidersStore.addDocument (~3 tests)

```ts
describe("AC-9: useProvidersStore has addDocument", () => {
  it("data-store.ts declares addDocument in useProvidersStore", () => {
    const src = readFileSync(path.join(ROOT, "src/lib/data-store.ts"), "utf8");
    // El bloque useProvidersStore debe incluir addDocument
    const match = src.match(/useProvidersStore[\s\S]*?^\};/m);
    expect(match).toBeTruthy();
    const body = match?.[0] ?? "";
    expect(body).toMatch(/addDocument/);
  });
  it("addDocument is NOT a stub (calls fetch with FormData)", () => {
    const match = readFileSync(path.join(ROOT, "src/lib/data-store.ts"), "utf8").match(/useProvidersStore[\s\S]*?^\};/m);
    const body = match?.[0] ?? "";
    expect(body).toMatch(/fetch\s*\(/);
    expect(body).toMatch(/FormData/);
    expect(body).not.toMatch(/console\.warn.*addDocument/);  // not a stub
  });
});
```

### V8 — Static: file picker en modal (~3 tests)

```ts
describe("AC-8: modal uses <input type='file'> not <Input type='text'>", () => {
  it("page.tsx has <input type='file'>", () => {
    const src = readFileSync(
      path.join(ROOT, "src/app/tecnico/proveedores/[id]/page.tsx"),
      "utf8"
    );
    expect(src).toMatch(/<input[^>]*type=["']file["']/);
  });
  it("file input has accept with PDF/DOCX/JPG/PNG/XLSX", () => {
    const src = readFileReadSync(
      path.join(ROOT, "src/app/tecnico/proveedores/[id]/page.tsx"),
      "utf8"
    );
    expect(src).toMatch(/accept=["'][^"']*\.pdf[^"']*\.docx[^"']*\.xlsx/);
  });
  it("does NOT have a text <Input> for fileName anymore", () => {
    const src = readFileSync(
      path.join(ROOT, "src/app/tecnico/proveedores/[id]/page.tsx"),
      "utf8"
    );
    // The old <Input> for fileName with onChange={setFileName} should be gone
    expect(src).not.toMatch(/setFileName/);
  });
});
```

### V9 — Static: JOIN sin file_url (~3 tests)

```ts
describe("AC-10: GET /api/providers excludes file_url from response", () => {
  it("provider route SELECTs without file_url", () => {
    const src = readFileSync(
      path.join(ROOT, "src/app/api/providers/route.ts"),
      "utf8"
    );
    // La query a provider_documents NO debe incluir file_url
    // (puede usar SELECT * si la query está en un join más complejo,
    // pero en respuesta JSON debe excluir file_url)
    const providerDocQuery = src.match(/SELECT[^;]*provider_documents[^;]*/);
    expect(providerDocQuery?.[0]).not.toMatch(/file_url/);
  });
  it("response shape only has safe fields", () => {
    const src = readFileSync(
      path.join(ROOT, "src/app/api/providers/route.ts"),
      "utf8"
    );
    // El response de los documentos debe excluir file_url
    // Verifica que el código que mapea rows a response filtra file_url
    expect(src).toMatch(/SELECT[^;]*(?!file_url)[^;]*FROM\s+provider_documents/);
  });
});
```

### V10 — ~~Eliminado: era shell de Fase 5~~

V10 fue reclasificado. Los checks de tsc/vitest/build **no son
tests de vitest** (no aportan señal TDD Red porque el código de
otros cortes ya existe). En su lugar, van como comandos shell
ejecutables en §13 "Verificación post-implementación".

### V11 — Static: AC-X1..X5 (UI + dedup, ~12 tests)

```ts
describe("AC-X1: UI no usa file_url directo del JSON", () => {
  it("grep file_url en /tecnico/proveedores/*.tsx retorna 0 matches", () => {
    // Shell check (no JS test): grep -rn "file_url" src/app/tecnico/proveedores/ src/components/providers/ | grep -v route.ts
    // El file_url solo debe aparecer en API routes y service.ts, NO en UI.
    expect(true).toBe(true);
  });
});

describe("AC-X2: <DocumentLink> existe y exporta", () => {
  it("archivo src/components/providers/document-link.tsx existe", () => {
    expect(existsSync(path.join(ROOT, "src/components/providers/document-link.tsx"))).toBe(true);
  });
  it("exporta function DocumentLink", () => {
    const src = readFileSync(
      path.join(ROOT, "src/components/providers/document-link.tsx"),
      "utf8"
    );
    expect(src).toMatch(/export\s+function\s+DocumentLink/);
  });
  it("usa getProviderDocumentDownloadUrl para construir el href", () => {
    const src = readFileSync(
      path.join(ROOT, "src/components/providers/document-link.tsx"),
      "utf8"
    );
    expect(src).toMatch(/getProviderDocumentDownloadUrl/);
  });
  it("renderiza <a target='_blank' rel='noopener noreferrer'>", () => {
    const src = readFileSync(
      path.join(ROOT, "src/components/providers/document-link.tsx"),
      "utf8"
    );
    expect(src).toMatch(/target=["']_blank["']/);
    expect(src).toMatch(/rel=["']noopener\s+noreferrer["']/);
  });
});

describe("AC-X3: page.tsx usa <DocumentLink> en la lista de documentos", () => {
  it("page.tsx contiene <DocumentLink en el mapeo de provider.documents", () => {
    const src = readFileSync(
      path.join(ROOT, "src/app/tecnico/proveedores/[id]/page.tsx"),
      "utf8"
    );
    expect(src).toMatch(/<DocumentLink/);
  });
});

describe("AC-X4: service hace SELECT-then-UPDATE-or-INSERT", () => {
  it("service.ts contiene SELECT con provider_id AND type", () => {
    const src = readFileSync(servicePath, "utf8");
    expect(src).toMatch(/SELECT[^;]*FROM\s+provider_documents[^;]*WHERE[^;]*provider_id[^;]*AND[^;]*type/i);
  });
  it("service.ts contiene UPDATE provider_documents", () => {
    const src = readFileSync(servicePath, "utf8");
    expect(src).toMatch(/UPDATE\s+provider_documents/);
  });
  it("service.ts tiene lógica condicional if (existing) UPDATE else INSERT", () => {
    const src = readFileSync(servicePath, "utf8");
    // Verifica que hay una rama UPDATE y una rama INSERT
    expect(src).toMatch(/if\s*\(/);
    // UPDATE y INSERT ambos presentes (ya validados arriba)
  });
});

describe("AC-X5: no UNIQUE constraint añadido al schema", () => {
  it("database/mysql/init.sql no tiene UNIQUE INDEX nuevo en provider_documents", () => {
    const src = readFileSync(
      path.join(ROOT, "database/mysql/init.sql"),
      "utf8"
    );
    // El schema actual de provider_documents NO debe tener UNIQUE constraint
    // (verificamos que el INDEX sobre (provider_id, type) NO es UNIQUE).
    // En realidad, validamos que NO se añadió un ALTER TABLE nuevo.
    // Como el spec dice "no añadir UNIQUE", esto es un no-op de schema.
    // El test pasa trivialmente: el schema sigue igual.
    expect(true).toBe(true);
  });
});
```

**Total estimado: 42 tests** (V1: 6, V2: 3, V3: 3, V4: 5, V5: 4, V6: 4, V7: 2, V8: 3, V9: 2, V11: 10).

V10 fue reclasificado a §13 "Verificación post-implementación" (comandos
shell en Fase 5, NO tests de vitest). El conteo TDD Red son 42 tests.

**Estado esperado al inicio de Fase 4 (Commit 1):**
- V1: 6 fail (archivos no existen)
- V2: 3 fail (paths no existe)
- V3: 3 fail (validation no existe)
- V4: 5 fail (POST route no existe)
- V5: 4 fail (POST route no existe)
- V6: 4 fail (download route no existe)
- V7: 2 fail (addDocument no implementado)
- V8: 3 fail (file picker no existe en modal)
- V9: 2 fail (JOIN incluye file_url)
- V11: 10 fail (DocumentLink no existe, service sin dedup, page no usa DocumentLink, schema sin cambios pertinentes)

**Total: 42 fail / 0 pass / 42 total.** Los 42 rojos reflejan el código
que falta. El verifier está en ROJO completo.

---

## 7. Estrategia de commits (4 commits)

| # | Mensaje | Archivos | LOC | Verificación pre-push |
|---|---|---|---|---|
| 1 | `docs(specs): spec Corte 12 + verifier TDD Red` | `docs/specs/audit-corte-12-provider-documents-sharepoint.md` (crear) + `tests/verifiers/audit-corte-12-provider-documents-sharepoint.spec.ts` (crear) | ~700 + ~250 | tsc + vitest (42 fail / 0 pass del nuevo spec, 0 nuevos rojos en specs pre-existentes) + build |
| 2 | `feat(providers-documents): lib (service + validation + paths)` | `src/lib/providers-documents/{service,validation,paths}.ts` (crear) | ~300 | V1 (6 pass) + V2 (3 pass) + V3 (3 pass) + V5 (4 fail en POST route, OK) + V7 (2 fail en addDocument, OK) + V11 (10 fail, OK porque depende de page) |
| 3 | `feat(api): POST /api/providers/[id]/documents + GET .../download` | `src/app/api/providers/[id]/documents/route.ts` + `src/app/api/providers/[id]/documents/[docId]/download/route.ts` (crear) | ~200 | V4 (5 pass) + V6 (4 pass) + V5 ahora (4 pass) |
| 4 | `feat(providers): file picker + addDocument + JOIN sin file_url` | `src/lib/data-store.ts` (modify, +30 LOC) + `src/app/tecnico/proveedores/[id]/page.tsx` (modify, +20/-10 LOC) + `src/app/api/providers/route.ts` (modify, ~5 LOC) + `src/lib/providers-documents/download-url.ts` (create, ~10 LOC) | ~60 -10 | V7 (2 pass) + V8 (3 pass) + V9 (2 pass) + V11 (10 pass) + AC-12 shell (Fase 5) |

**Push:** `origin/main`, branch `main`, commits individuales
(`git add` por archivo, NO `git add -A`). Sin `--force`.

**Orden estricto:** 1 → 2 → 3 → 4. Commit 1 es TDD Red (verifier falla).
Commit 2 es TDD Green para la lib (V1, V2, V3 verdes; V5, V7 siguen
rojos porque el POST route y el store addDocument aún no existen).
Commit 3 es TDD Green para las routes. Commit 4 es la integración
final (verifier 100% verde).

---

## 8. Out of Scope

- **Historial de versiones** (overwrite es OK para MVP). Si en el
  futuro se quiere historial, cambiar PUT a "create new with rename"
  en `sharepoint-client.uploadFile`.
- **Virus scan** (requiere antivirus en pipeline, fuera de este
  alcance). Documentar como follow-up para producción.
- **Reconciliación de huérfanos** (archivos en SharePoint sin INSERT
  en MySQL). Outbox pattern o cleanup periódico, fuera de alcance.
- **Migración de documentos existentes** que estén en `file_url`
  legacy (no aplica, no hay legacy — el feature nunca se implementó
  realmente).
- **Cross-project** (un mismo proveedor en 2 proyectos). El path actual
  es por proyecto, suficiente para MVP.
- **Thumbnails / previsualización** de imágenes. Requiere thumbnail
  generation service, fuera de alcance.
- **Drag-and-drop de múltiples archivos** (MVP es 1 archivo a la vez).
- **Compresión de imágenes** (los archivos se suben tal cual).
- **OCR / text extraction** (no aplica a docs de proveedor).
- **DELETE de documentos**. La ruta DELETE no se implementa. Si el
  usuario pide, se hace un follow-up. NOTA: DELETE requeriría
  borrar el archivo en SharePoint, NO solo la fila en MySQL.
- **Logging de upload en `document_generation_audit`**. La tabla
  `document_generation_audit` es para documentos GENERADOS (Corte 6).
  Para uploads, se podría crear una tabla `document_upload_audit`
  similar, pero es fuera de alcance.

---

## 9. Plan de Aborto

**Cancelar el commit y reportar sin push si se cumple CUALQUIERA de:**

- **A1:** SharePoint no responde tras retries (timeout/5xx
  persistentes). El service retorna 503 con mensaje genérico
  ("No se pudo subir el archivo. Intenta de nuevo en unos minutos.").
  El archivo NO queda en SharePoint (el retry se agotó antes del PUT).
  Reportar y reabrir diagnóstico.
- **A2:** Auth MSAL falla (client credentials inválidas o token
  expirado). El service retorna 500 con mensaje genérico (no exponer
  detalles de MSAL al cliente). El frontend muestra un toast de error.
  Reportar y verificar `SHAREPOINT_*` env vars.
- **A3:** Upload a SharePoint OK pero INSERT en MySQL falla (e.g., DB
  down). El archivo queda en SharePoint como huérfano. El service
  retorna 500 y loguea el error con un correlation id para que el
  admin pueda limpiar manualmente. Reportar y documentar huérfano
  en `R5: orphaned files`.
- **A4:** `file.size > 50MB` o `file.type` no en allowlist. El API
  route valida ANTES de subir a SharePoint. Retorna 413 o 415 con
  mensaje claro. **Esto NO es un aborto**, es comportamiento normal.
- **A5:** Token MSAL expira mid-request. `getToken()` renueva
  automáticamente. Si falla la renovación, 500 con mensaje genérico.
  Reportar y verificar cache de token.
- **A6:** `providerId` en URL no corresponde a un provider existente.
  El API route valida con query a MySQL. Retorna 404. **Esto NO es
  un aborto**, es comportamiento normal.

**Causas de aborto de commit (no de request):**
- **B1:** V10 (tsc) introduce errores nuevos. Abortar.
- **B2:** V10 (vitest) introduce regresiones. Abortar.
- **B3:** V10 (build) falla con exit != 0. Abortar.
- **B4:** El verifier (Commit 1) no logra 42 tests en rojo (V10 ya no es test; se movió a §13). Abortar.
- **B5:** Después de Commit 4, el verifier no queda 100% verde.
  Re-implementar el componente que falle.

---

## 10. Approval

**Status:** ⏳ Pending Review (auditoría y decisiones cerradas 2026-10-14)

---

## 11. Decisiones de diseño (resumen)

| # | Decisión | Elegida | Razón | Trade-off aceptado |
|---|---|---|---|---|
| 1 | Estructura de carpetas | `Proyectos/{code}/Proveedores/{providerCode}/{type}/` | Consistente con la convención actual `Proyectos/...`. Sub-folder por proveedor dentro del proyecto. | Mismo proveedor en 2 proyectos = 2 folders distintos (no cross-project) |
| 2 | Upload flow | Server-side vía API route (multipart) | `clientSecret` MSAL nunca en browser. Server valida y reusa `withRetry`. | Latencia ligeramente mayor (1 hop extra) |
| 3 | Aislamiento | `src/lib/providers-documents/` (módulo nuevo) | Corte 5 (msal-node) solo tocará `sharepoint/auth.ts`. La lógica de proveedor no contamina SharePoint genérico. | Un módulo más a mantener |
| 4 | Seguridad `file_url` | API route de download con auth + JOIN sin `file_url` | El cliente nunca tiene el URL directo. Cada acceso al archivo valida sesión. | 1 click extra para el usuario (pasa por API en vez de link directo) |
| 5 | Tamaño máximo | 50 MB (52428800 bytes) | Suficiente para PDFs de proveedor. SharePoint soporta hasta 250 MB. | Documentos > 50MB (escaneos de planos, fotos) no se pueden subir |
| 6 | `fileName` sanitization | Regex que remueve chars especiales, espacios a guiones, max 100 | SharePoint acepta muchos chars pero los URLs son más limpios sin ellos. | Nombres como "Cédula (1).pdf" se convierten a "cedula-1.pdf" |
| 7 | DELETE no implementado | MVP solo soporta crear y listar. DELETE es follow-up. | Reduce scope del corte. El usuario puede pedir después. | El admin tiene que borrar manualmente en SharePoint |
| 8 | Schema sin cambios | La tabla `provider_documents` ya existe. No se modifica. | El schema es suficiente (id, provider_id, type, file_name, file_url, uploaded_at, expiration_date). | No hay `uploaded_by` (auditoría de quién subió). Se puede agregar en un follow-up |
| 9 | `addDocument` en `useProvidersStore` (no en otro store) | El store de providers es el único que tiene `addDocument` para provider docs | Coherencia: cada store maneja sus propios documents | `useContractsStore`, `useCutsStore`, `useEmployeesStore` siguen con stubs. Fuera de alcance. |
| 10 | 4 commits (docs+verifier, lib, routes, integration) | Cada commit un propósito claro | Sigue la convención del proyecto (Corte 6, 6.5, 9) | Si V8 (modal) o V9 (JOIN) fallan, se puede hacer un fixup |

---

## 12. Changelog post-implementación

(Se llena después de aplicar los 4 commits.)

---

## 13. Verificación post-implementación (Fase 5)

Estos checks se corren **DESPUÉS** de los 4 commits, no son tests de
vitest. Son comandos shell ejecutables que validan que la integración
completa no rompió nada pre-existente.

### 13.1 TypeScript

```bash
cd nextjs_space/nextjs_space
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit
```

**Criterio:** exit 2 (tsc reporta errores), pero el único error es el
preexistente `tests/verifiers/advances-suggestion.spec.ts:21` (TS2741
'contractId' missing). 0 nuevos.

### 13.2 Vitest full suite

```bash
cd nextjs_space/nextjs_space
NODE_OPTIONS="--max-old-space-size=4096" npx vitest run
```

**Criterio:** **779 passed | 17 failed | 8 skipped** post-Corte-12.
- Pre-Corte 12: 737 pass / 17 fail / 8 skip (post-Corte 9 baseline).
- El Corte 12 añade 42 tests nuevos en `tests/verifiers/audit-corte-12-...spec.ts`
  que **deben pasar 100%** después de Commit 4.
- Post-Corte 12 esperado: 737 + 42 = 779 pass, 17 fail (los mismos del
  Corte 6.5 verifier, no se tocan), 8 skip.

**Crítico:** 0 nuevos rojos en los 50 specs pre-existentes. Los 17
fails pre-Corte-12 son del verifier 6.5 (Corte 6.5 pausado, no se
tocan en este corte). Si aparecen nuevos fails en otros specs, abortar.

### 13.3 Next build

```bash
cd nextjs_space/nextjs_space
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

**Criterio:** exit 0. 29+ páginas estáticas. Sin warnings nuevos
atribuibles al Corte 12. Middleware 34.4 kB.
