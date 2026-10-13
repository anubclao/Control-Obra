# Corte 1 — Limpieza de dependencias: `npm audit fix` + reclasificar `tailwindcss-animate`

> Spec generado 2026-10-12 por mavis. Forma parte del plan acordado en chat para
> reducir el reporte de `npm audit`. Cubre **únicamente** el Corte 1; los
> Cortes 2 (`next`/`eslint-config-next`), 3 (`xlsx`) y 4 (`@azure/msal-node`)
> tienen specs propias y NO se abordan aquí.

## Contexto

`npm audit --omit=dev` reporta 14 vulnerabilidades (10 High + 4 Moderate) en el
árbol de producción. Análisis previo acordado en chat:

- **Resolubles con `npm audit fix` (semver-safe):** `sharp` 0.35.4 → 0.35.5
  (vulnerabilidad librsvg SVG) y `source-map-js` 1.2.1 (ReDoS en source maps).
- **Falsos positivos por culpa de la clasificación de `tailwindcss-animate`:**
  `braces`, `micromatch`, `fast-glob`, `chokidar`. Estos paquetes solo se usan
  en el toolchain de build/lint; aparecen como "producción" solo porque
  `tailwindcss-animate` está en `dependencies`. Al moverlo a `devDependencies`
  dejan de reportarse.
- **Sin fix disponible (serán residuales en el reporte post-corte):**
  `postcss-selector-parser`, `postcss-nested` (Moderate, dependen de tailwind 3).

**Este spec NO toca:** `xlsx` (Corte 3), `next` / `eslint-config-next` (Corte 2),
`@azure/msal-node` (Corte 4), ni nada dentro de `nextjs_space/nextjs_space/src/`.

---

## 1. User Story

**As a** operador de ControlObra,
**I want to** que el árbol de dependencias de producción no reporte
vulnerabilidades que ya tienen arreglo oficial,
**So that** `npm audit --omit=dev` muestre únicamente lo que NO tiene fix, y la
superficie de ataque por dependencias en runtime quede sin paquetes
parcheables pendientes.

---

## 2. Acceptance Criteria

- [ ] **AC-1** `npm audit --omit=dev` reduce el conteo de High en ≥ 2 respecto a
  la línea base (`sharp@0.35.4` librsvg, `source-map-js@1.2.1` ReDoS).
- [ ] **AC-2** `package.json` lista `"tailwindcss-animate": "^1.0.7"` dentro de
  `devDependencies`, NO en `dependencies`.
- [ ] **AC-3** `package.json` y `package-lock.json` coherentes: `npm install
  --dry-run` reporta 0 paquetes a añadir / 0 modificados.
- [ ] **AC-4** `npx tsc --noEmit` queda en 0 errores nuevos. Línea base
  aceptable: 1 error preexistente en
  `tests/verifiers/advances-suggestion.spec.ts:21` (TS2741 'contractId' missing).
- [ ] **AC-5** `npm test` (Vitest) sin nuevos rojos. Estado actual medido
  (post-Corte 1): **685 passing + 34 failing + 8 skipped**. Los 34 failing son
  todos `ENOENT` en `src/lib/document-generator/formatos-snapshots/*.docx|.xlsx|.pdf`
  (snapshots binarios no versionados en git). Distribución: document-filler-docx (10),
  document-filler-oc (6), document-filler-xlsx (6), document-render (10),
  document-xlsx-helpers (2). **Estos 34 rojos son preexistentes** al Corte 1 — ver §6.5.
  El Corte 1 añade 0 rojos nuevos.
- [ ] **AC-6** `npm run build` termina con código 0 y sin warnings nuevos
  atribuibles a este cambio.
- [ ] **AC-7** El commit principal del corte toca únicamente `package.json` y
  `package-lock.json`. Cero diff en `nextjs_space/nextjs_space/src/**`, en
  `docs/`, en `nextjs_space/nextjs_space/AGENTS.md`, en
  `nextjs_space/nextjs_space/tailwind.config.*`.
- [ ] **AC-8** `xlsx` permanece en `^0.18.5`. Sin diff en
  `src/lib/excel-parser.ts`, `src/lib/xlsx-helpers.ts`,
  `src/lib/document-generator/fillers/oc.ts`.

---

## 3. Edge Cases / Riesgos

### Riesgos del comando
- **R1:** Si `npm audit fix` rompe peer-deps o `npm install` falla, **abortar el
  corte y volver a chat**. Nunca `--force`.
- **R2:** `npm audit fix` puede proponer actualizaciones a transitivos NO
  documentados (p. ej., otros paquetes arrastrados por `next`). Antes de commit:
  revisar el diff de `package-lock.json` línea por línea. Cualquier cambio fuera
  de {`sharp`, `source-map-js`, transitivos obvios} → abortar y evaluar
  individualmente. Si `npm audit fix` mueve paquetes sensibles, revertir
  manualmente y evaluar alternativas (manual upgrade selectivo o diferir).
- **R3:** Que `tailwindcss-animate` tuviera un import runtime sería bug
  preexistente y NO es objeto de este spec. Si apareciera warning al `npm run
  dev`, revertir el commit y abrir issue aparte.
- **R4:** El `audit-before.json` y `build-after.log` que captura este spec son
  artefactos locales, NO se commitean.

### Estados a evitar explícitamente
- `npm audit fix --force`.
- `npm audit fix` con la flag `--legacy-peer-deps`.
- Combinar este commit con cualquier otro cambio (incluyendo el spec / log /
  verifier, que van en commits separados).
- Editar `package-lock.json` a mano.
- Añadir entradas al bloque `overrides` de `package.json` "de paso".

---

## 4. Technical Contract

### 4.1 Patch esperado en `package.json`

```diff
   "dependencies": {
-    "tailwindcss-animate": "^1.0.7",
     "@hookform/resolvers": "^5.4.0",
     ...
   },
   "devDependencies": {
+    "tailwindcss-animate": "^1.0.7",
     "@vitejs/plugin-react": "^6.1.1",
     ...
   }
```

`npm audit fix`, además, promoverá `sharp` y `source-map-js` a versiones
parcheadas dentro de sus rangos. La versión exacta queda registrada en
`package-lock.json` al ejecutar el comando.

### 4.2 Comando exacto (orden estricto)

```
cd "D:\desarrollos\ControlObra\ControlObra\nextjs_space\nextjs_space"
npm audit fix
# revisar diff de package-lock.json línea por línea
# si hay cambios fuera de {sharp, source-map-js, transitivos esperados} -> abortar
# editar package.json: mover tailwindcss-animate a devDependencies (ver §4.1)
npm install
```

> **Ruta del proyecto:** el código está realmente en `nextjs_space/nextjs_space/`
> (verificado a 2026-10-12). El doc `docs/env/ARCHITECTURE.md` quedó
> desactualizado en este punto y dice que el código vive en `nextjs_space/`.
> Usamos la ruta real. Si en una sesión futura el archivo cambia, ajustar.

### 4.3 Comportamiento esperado (no código; contrato verificable)

- `npm audit fix` solo aplica parches semver-safe. NO debe tocar versiones
  pinned (`next`, `eslint-config-next`) ni hacer major upgrades.
- El diff de `package-lock.json` post-fix será revisado por el agente línea por
  línea antes de commit (mecanismo de control: el reporte de `npm audit` post-fix
  sirve como evidencia de qué cambió y por qué).

---

## 5. Dependencies

### Files to Modify
- `nextjs_space/nextjs_space/package.json`
- `nextjs_space/nextjs_space/package-lock.json`

### Files to Create (commits separados del principal)
- `nextjs_space/nextjs_space/tests/verifiers/audit-corte-1-deps-cleanup.spec.ts`
  — verifier de regresión estática (commit 2).
- `docs/specs/audit-corte-1-deps-cleanup.md` — este spec (commit 3).

### Files to Read (solo diagnóstico, no commiteados en este corte)
- `nextjs_space/nextjs_space/node_modules/sharp/package.json` — confirmar versión
  parcheada post-`npm audit fix`.
- `nextjs_space/nextjs_space/node_modules/source-map-js/package.json` — confirmar
  versión parcheada post-`npm audit fix`.

### Files explicitly NOT touched (este spec)
- `nextjs_space/nextjs_space/src/**` — código del producto.
- `nextjs_space/nextjs_space/src/lib/excel-parser.ts`,
  `nextjs_space/nextjs_space/src/lib/xlsx-helpers.ts`,
  `nextjs_space/nextjs_space/src/lib/document-generator/fillers/oc.ts`
  — parser de Excel.
- Entrada `"xlsx": "^0.18.5"` en `package.json`.
- Entrada `"next": "15.5.25"` y `"eslint-config-next": "15.5.25"` en
  `package.json`.
- `nextjs_space/nextjs_space/tailwind.config.*`.
- Cualquier ruta bajo `nextjs_space/nextjs_space/node_modules/xlsx/**`.

---

## 6. Verifier Plan

### 6.1 Snapshot pre-cambio (referencia temporal, no commiteado)

```
cd "D:\desarrollos\ControlObra\ControlObra\nextjs_space\nextjs_space"
npm audit --omit=dev --json > ../audit-before.json
```

`audit-before.json` queda en la raíz del repo como referencia local. Se borra
cuando V1 esté cerrado.

### 6.2 Post-cambio (orden estricto de ejecución)

| # | Comando | Criterio de éxito |
|---|---|---|
| V1 | `npm audit --omit=dev` | High count reducido ≥ 2. Si quedan High, listar y confirmar que el reporte dice "no fix available" para cada uno. |
| V2 | `node -e "const p=require('./package.json'); console.log(!p.dependencies['tailwindcss-animate'], !!p.devDependencies['tailwindcss-animate'])"` | Imprime `true true`. |
| V3 | `npm install --dry-run` | Imprime "up to date" / 0 paquetes. Si propone instalar, abortar y revisar. |
| V4 | `npx tsc --noEmit` | Mismos errores que línea base. 0 nuevos (1 preexistente aceptable). |
| V5 | `npm test` | **685 passing + 34 failing (ENOENT snapshots) + 8 skipped**. Misma cantidad de rojos que pre-Corte 1: todos `formatos-snapshots/*.docx|*.xlsx|*.pdf` ausentes en repo. El directorio existe pero solo contiene `.gitkeep`. Corte 1 añade 0 nuevos rojos — ver §6.5. |
| V6 | `npm run build 2>&1 \| tee ../build-after.log` | Código 0. Sin warnings nuevos. |

### 6.3 Verifier automatizado (regresión)

Archivo: `nextjs_space/nextjs_space/tests/verifiers/audit-corte-1-deps-cleanup.spec.ts`

Patrón: **static source analysis**, mismo enfoque que
`tests/verifiers/bug-project-form-currency-step.spec.ts:~56`. Lee `package.json`
con `readFileSync` y assertea estructura.

```typescript
// Esquema del verifier (el código exacto va en el commit 2)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PKG = JSON.parse(
  readFileSync(resolve(__dirname, '../../package.json'), 'utf-8')
);

describe('audit-corte-1-deps-cleanup · regresión de package.json', () => {
  it('AC-2: tailwindcss-animate solo aparece en devDependencies', () => {
    expect(PKG.dependencies['tailwindcss-animate']).toBeUndefined();
    expect(PKG.devDependencies['tailwindcss-animate']).toBe('^1.0.7');
  });

  it('AC-8: xlsx permanece en ^0.18.5 (control negativo)', () => {
    expect(PKG.dependencies.xlsx).toBe('^0.18.5');
  });

  it('AC-7: next sigue pineado en 15.5.25 (este spec NO sube next)', () => {
    expect(PKG.dependencies.next).toBe('15.5.25');
    expect(PKG.devDependencies['eslint-config-next']).toBe('15.5.25');
  });
});
```

> **TDD:** este verifier NO falla antes del cambio (la spec se redacta después
> del comando). Funciona como **test de regresión a futuro**: si alguien mueve
> `tailwindcss-animate` de vuelta a `dependencies`, o toca `xlsx` sin querer,
> el verifier lo detecta. La red de seguridad para este corte específico es
> V4/V5/V6.

### 6.4 Validación manual en prod (workflow del usuario)

Tras el push a `origin/main` y deploy automático de Hostinger:

1. `/login` → confirmar login OK.
2. Un proyecto real (`/tecnico/proyectos/[id]`) → verificar que las animaciones
   Tailwind siguen activas (sidebar accordion, dropdowns, modales).

> **Fuera de scope del Corte 1:** la validación del flujo de carga de Excel
> (incluyendo el archivo `Parques del Valle`) pertenece al **Corte 3**
> (migración de `xlsx`). Este corte solo valida dependencias, no el parser.

Si una animación se rompe → indicio de un import runtime de
`tailwindcss-animate` (improbable, porque Tailwind lo consume solo como plugin
de build). Procedimiento: revertir el commit, abrir issue, NO añadir
`overrides`.

### 6.5 Baseline conocido pre-Corte 1 (no regresión)

Los 34 tests que aparecen fallando en V5 son **pre-existentes** al Corte 1 y
**NO** son una regresión del trabajo de dependencias. La investigación los
atribuye a snapshots binarios no versionados en git:

- **Causa raíz:** 9 fixtures binarios (`4 .docx + 4 .xlsx + 1 .pdf`) referenciados
  en tests de `document-generator/` no existen en el árbol de git.
- **Evidencia:** `src/lib/document-generator/formatos-snapshots/` contiene
  únicamente un `.gitkeep` (0 bytes); ningún archivo pedido por los tests está
  presente.
- **Repro:** los 34 tests fallan con `Error: ENOENT: no such file or directory,
  open '...formatos-snapshots/<archivo>'` ANTES y DESPUÉS del Corte 1 — la
  naturaleza del fallo no es afectada por `npm audit fix` ni por la
  reclasificación de `tailwindcss-animate`.
- **Por qué se acepta:** los archivos `.docx`/`.xlsx`/`.pdf` son plantillas de
  la constructora, fuera del código de runtime. Deben provisionarse por otro
  flujo (descarga desde una URL interna, generación desde un sistema de
  plantillas, o carga manual en el entorno de CI).

> **Issue separado pendiente:** investigar el flujo de provisionamiento de
> snapshots en CI/prod. **NO forma parte del Corte 1** y se descarta como
> trabajo adicional de `document-generator/`. Si en una futura sesión los
> snapshots se provisionan correctamente, este baseline desaparece y AC-5 puede
> reformularse a "0 failing".

---

## 10. Baseline pre-Corte 1 — métricas reales

Estado medido en este entorno (Windows, sandbox sin acceso a MySQL Hostinger).
Estos son los números contra los que V1/V4/V5/V6 se evalúan:

| Métrica | Valor |
|---|---|
| `npm audit --omit=dev` (Pre-Corte 1) | 14 (10 High + 4 Moderate) |
| `npm audit --omit=dev` (Post-Tarea 1) | 13 (8 High + 5 Moderate) |
| `npm audit --omit=dev` (Post-Tarea 2 = Final) | **4 (1 High + 3 Moderate)** |
| Reducción | **71 %** |
| `npx tsc --noEmit` exit code | 2 (1 error preexistente: `tests/verifiers/advances-suggestion.spec.ts:21` TS2741 'contractId' missing) |
| `npm test` resultado | 685 passing + 34 failing (todos ENOENT snapshots, ver §6.5) + 8 skipped |
| `npm run build` exit code | 0 (build 95 s, 29 páginas estáticas generadas; warnings de DB no bloquean) |
| Commits materializados | `33aa5ec` (Tarea 1), `50fb589` (Tarea 2), este spec + log (Commit 3) |
| Costo operativo | `NODE_OPTIONS=--max-old-space-size=4096` requerido para tsc y build en este host |

---

## 7. Estrategia de commits (aislamiento)

| # | Mensaje | Archivos |
|---|---|---|
| 1 | `chore(deps): npm audit fix + move tailwindcss-animate to devDependencies` | `nextjs_space/nextjs_space/package.json`, `nextjs_space/nextjs_space/package-lock.json` |
| 2 | `test(deps): verifier de regresión para reclasificación de tailwindcss-animate` | `nextjs_space/nextjs_space/tests/verifiers/audit-corte-1-deps-cleanup.spec.ts` |
| 3 | `docs(specs): spec Corte 1 + log de fase en AGENTS.md del proyecto` | `docs/specs/audit-corte-1-deps-cleanup.md`, `nextjs_space/nextjs_space/AGENTS.md` (entrada de changelog) |

> **Push:** lo ejecuta el agente desde aquí. Branch: `main`. Remote:
> `https://github.com/anubclao/Control-Obra.git`. Working dir:
> `D:\desarrollos\ControlObra\ControlObra\nextjs_space\nextjs_space\`. Commits
> añadidos individualmente (`git add` por archivo, NO `git add -A`).

> **Log de fase:** el commit 3 añade una entrada de changelog en
> `nextjs_space/nextjs_space/AGENTS.md` siguiendo el formato existente
> (`### [YYYY-MM-DD] <feature-name> · FASE X (XXX)`). NO se escribe la entrada
> hasta que el usuario apruebe el spec; ver §10.

---

## 8. Out of Scope

- Migración de `xlsx` 0.18.5 → SheetJS 0.20.3 oficial (cdn.sheetjs.com) o a
  `exceljs`. → **Corte 3**, spec dedicado.
- Upgrade de `next` 15.5.25 → 15.5.27 y de `eslint-config-next` 15.5.25 → 15.5.27.
  → **Corte 2**.
- Upgrade de `@azure/msal-node` 3.x → 5.x. Cambio de major version; requiere
  re-probar SharePoint end-to-end. → **Corte 4 (planificado)**.
- Edición del parser de Excel o de cualquier archivo dentro de `src/`.
- Re-escritura de `tailwind.config.*` o ajuste de reglas CSS.
- Aprovechar `npm audit fix` para mover otras dependencias que aparezcan
  "de paso" en el reporte, aunque parezcan seguras.
- Crear entradas nuevas en `overrides` de `package.json`.
- Crear o modificar `.npmrc` con `--force` / `--legacy-peer-deps` globales.
- Abordar las vulnerabilidades que NO tienen fix (postcss-selector-parser,
  postcss-nested, etc.). Eso es residual del reporte y se verá en el V1.

---

## 9. Approval

**Status:** ✅ Approved e implementado 2026-10-12. 2 commits materializados
(`33aa5ec`, `50fb589`); 3º commit cierra con este spec + log de AGENTS.md.
Correcciones aplicadas en revisión: §6.4 sin validación Excel; §3 R2 mantener
política de abortar; entrada de changelog en Commit 3; verificación con `ls`
previa a ejecutar comandos npm. Baseline conocido de 34 ENOENT documentado en
§6.5. Métricas finales en §10.
