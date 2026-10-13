# Mini-spec — Wiring de `sync-formatos-snapshots` (baseline 719 verde)

> Spec generado 2026-10-12 por mavis. Entregable técnico entre los Cortes 1+2
> (ya cerrados) y el Corte 3 (`xlsx`). Objetivo: llevar `npm test` al baseline
> limpio **719 passing / 0 failing / 8 skipped** antes de abrir el Corte 3, de
> modo que el bump de `xlsx` tenga la red de seguridad de tests completa.

## Contexto

`npm test` post-Corte 2 reporta **685 passing / 34 failing / 8 skipped**. Los 34
fallos son `ENOENT` en `src/lib/document-generator/formatos-snapshots/` (10 archivos
binarios no versionados — 4 docx + 5 xlsx + 1 pdf). Diagnóstico previo
(documentado en respuestas anteriores):

- **Existe** `scripts/sync-formatos-snapshots.mjs` que copia `/Formatos/` →
  `formatos-snapshots/`.
- **El script tiene 3 defectos** para llegar al objetivo:
  - Su `FORMATS_DIR` apunta 1 nivel abajo de la ubicación real
    (`../../FORMATOS/` vs `../Formatos`).
  - Su algoritmo copia preservando el nombre original, pero los nombres
    canónicos que esperan los tests (`OC.xlsx`, `CONT_LABORAL.docx`, etc.) son
    más cortos que los nombres oficiales del área legal
    (`3.5. FORMATO OC_ ORDEN DE COMPRA.xlsx`,
    `CONTRATO DE TRABAJO A TÉRMINO INDEFINIDO.docx`, etc.).
  - **No está wireado como `globalSetup` en `vitest.config.mjs`**; el comentario
    del script sugiere lo contrario pero la configuración real nunca lo
    añadió. Resultado: el sync nunca se ejecuta antes de `npm test`.
- **El sync falla en silencio** cuando `FORMATS_DIR` no existe (devuelve
  `ok: false, reason: "..."` sin abortar), por lo que el problema se ha
  enmascarado como "tests fallando" en lugar de "configuración rota".
- **`formatos-snapshots/` no está gitignoreado**: si los binarios aterrizan
  ahí, aparecerán como `untracked` y son riesgo de commit accidental.

Este mini-spec **NO toca** el parser de Excel, `xlsx`, `next`, ni nada de los
Cortes 1/2/3/4. Es trabajo de tooling-interno (scripts + config) previo a la
apertura del Corte 3.

---

## 1. User Story

**As a** desarrollador que corre `npm test` localmente o en CI,
**I want to** que vitest sincronice automáticamente las plantillas reales desde
`/FORMATOS/` (o equivalente) antes de correr los tests de `document-generator/`,
**So that** la suite reporte el baseline limpio (719 verde, 0 rojo, 8 skip) en
cualquier máquina con acceso a las plantillas, sin intervención manual.

---

## 2. Acceptance Criteria

- [ ] **AC-1** `vitest.config.mjs` añade
      `globalSetup: ["./scripts/sync-formatos-snapshots.mjs"]` para que el sync
      corra automáticamente antes de los tests.
- [ ] **AC-2** El sync tiene **3 modos de operación** según la
      disponibilidad de `FORMATOS_DIR` y de los snapshots locales.
      Verificado empíricamente 2026-10-12 contra los dos escenarios
      extremos.

      **Modo 1 — Happy path** (FORMATOS_DIR existe vía env o fallback):
      copia los 10 archivos desde FORMATOS/ a formatos-snapshots/
      vía NAME_MAP, con idempotencia size+mtime y warnings para
      archivos no-mapeados. Sin cambios respecto al flujo original.

      **Modo 2 — Smart-skip** (FORMATOS_DIR NO se encuentra en ningún
      lado, **PERO** los 10 snapshots canónicos están en disco):
      el script **continúa sin abort**. Imprime 1 sola línea
      informativa:
      ```
      ℹ️  FORMATOS_DIR no encontrado, pero los 10 snapshots canónicos están en disco. Continuando sin sincronizar (smart-skip).
      ```
      Devuelve `source: 'smart-skip'` en el resultado. **No llama a
      `fs.mkdir`, no copia archivos, no aborta.** Vitest globalSetup
      retorna clean y la suite corre con los snapshots cacheados.

      **Modo 3 — Hard-abort** (FORMATOS_DIR NO se encuentra Y al menos
      un snapshot canónico falta en disco): el script abort con
      `process.exit(1)` y mensaje estructurado listando:
      - Las 4 rutas buscadas (env + 3 candidatas).
      - El conteo de snapshots presentes (e.g. `7/10`).
      - Lista explícita de los archivos canónicos faltantes
        (`AD-0033.xlsx`, `LEG.xlsx`, etc.).
      - Sugerencia: restaurar FORMATOS/ desde una copia oficial, o
        ejecutar el sync con `FORMATOS_DIR` válido.

      **Decisión (2026-10-12): opción C — smart-skip**
      (anteriormente opción A, corregido el mismo día tras análisis
      del usuario). Razón:
      - **Problema original** era "fallo silencioso con 34 ENOENTs que
        parecen tests rotos". El modo 2 evita esto: aunque FORMATOS/
        falte, los snapshots en disco son válidos y los tests pasan.
        No hay regresión silenciosa.
      - **Modo 3 cubre el hueco real**: si FORMATOS/ falta Y los
        snapshots también faltan (porque alguien borró el directorio),
        abortamos con lista de archivos concretos. El operador sabe
        exactamente qué restaurar.
      - **CI no se bloquea** innecesariamente: un dev que tiene
        FORMATOS/ en su máquina, commitea y empuja, y CI clona el
        repo sin FORMATOS/ — la primera corrida usa smart-skip con
        snapshots cacheados hasta que el operador configure el acceso.

      **Verificación empírica:**
      - V2b (smart-skip): `FORMATOS_DIR=D:\nonexistent\formatos` +
        snapshots presentes → `EXIT: 0`, summary `copied=0, skipped=10,
        warnings=0`, source=`smart-skip`.
      - V2c (hard-abort): `FORMATOS_DIR=D:\nonexistent\formatos` +
        snapshots borrados → `EXIT: 1`, mensaje lista 4 rutas +
        `Snapshots presentes: 0/10` + 10 archivos faltantes listados.
      - V5 redux: `npm test` sigue reportando `Tests  719 passed | 8 skipped (727)` con la nueva lógica.

      **Revisión pendiente al montar CI:** confirmar que el runner
      tiene acceso a FORMATOS/ o implementar un flag
      `SKIP_TEMPLATE_SYNC=1` para entornos donde FORMATOS/ no está
      disponible pero solo se quieren correr los tests no-dependientes-
      de-formatos. NO se implementa ahora.
- [ ] **AC-3** Resolución de `FORMATS_DIR`, en este orden de prioridad:
      1. `process.env.FORMATOS_DIR` (si está definida y existe).
      2. `path.resolve(projectRoot, "..", "..", "FORMATOS")` (ubicación real
         encontrada durante el diagnóstico).
      3. `path.resolve(projectRoot, "..", "Formatos")` (lo que el script
         original esperaba).
      4. `path.resolve(projectRoot, "..", "..", "..", "FORMATOS")` (fallback
         por si la estructura del repo se anida distinto en algún clone).
      5. Si ninguno existe → abortar.
- [ ] **AC-4** Tabla de mapeo estática source → canonical en el script, con
      los 10 pares confirmados durante el diagnóstico. El script usa la tabla
      para renombrar el archivo al copiarlo.
      Source → Destination:

      ```
      "3.2. AD-0033- SOLICITUD DE ANTICIPO.xlsx"          → "AD-0033.xlsx"
      "3.3. FORMATO DE LEGALIZACIÓN O REINTEGRO.xlsx"     → "LEG.xlsx"
      "3.5. FORMATO OC_ ORDEN DE COMPRA.xlsx"            → "OC.xlsx"
      "3.6. FORMATO OS_ ORDEN DE SERVICIO.xlsx"          → "OS.xlsx"
      "3.7. FORMATO DE CORTE Y MEMORIAS DE OBRA_1.xlsx"  → "CORTE.xlsx"
      "3.9. FORMATO AUSENCIA LABORAL[1].pdf"              → "AUSENCIA.pdf"
      "CONTRATO DE TRABAJO A TÉRMINO INDEFINIDO.docx"     → "CONT_LABORAL.docx"
      "CONTRATO DISEÑOS.docx"                             → "CONT_DISENOS.docx"
      "V1-OBRA-PRECIO GLOBAL.docx"                        → "CONT_GLOBAL.docx"
      "V2-MODELO OBRA-PRECIO UNITARIO.docx"               → "CONT_UNITARIO.docx"
      ```

- [ ] **AC-5** El script **avisa** con warning explícito (no aborta) si en
      `FORMATS_DIR` aparecen archivos `.xlsx/.docx/.pdf` que NO están en la
      tabla de mapeo. Sirve para que el área legal agregar nuevas plantillas
      no pase desapercibida.
- [ ] **AC-6** Idempotencia con `size + mtime`: si el archivo destino existe
      y su size + mtime coinciden con el source, el script **no recopía** y
      reporta `skipped`. Si cualquiera difiere, recopía.
- [ ] **AC-7** Output del sync es legible: imprime por línea el resultado
      por archivo (`copied`, `skipped`, `unmapped-warning`, `error`). Al
      final, un summary: `copied=N skipped=M warnings=K`. Si CLI, formato
      humano; si globalSetup, formato corto.
- [ ] **AC-8** Modo `--dry-run` (`node scripts/sync-formatos-snapshots.mjs
      --dry-run`): reporta qué archivos copiaría/skippearía/advertiría, sin
      tocar el filesystem destino. Útil para debug.
- [ ] **AC-9** Mensaje de aborto claro (no stack trace feo) cuando
      `FORMATS_DIR` no se encuentra. Formato:

      ```
      ❌ FORMATOS_DIR no encontrado.
         Buscado en:
           1. $FORMATOS_DIR              (env var, no definida)
           2. <ruta absoluta>            (no existe)
           3. <ruta absoluta>            (no existe)
           4. <ruta absoluta>            (no existe)
         Defina FORMATOS_DIR o coloque la carpeta FORMATOS en una de esas rutas.
         Ver docs/specs/audit-formatos-snapshots-wiring.md §AC-3.
      ```

- [ ] **AC-10** `.gitignore` añade el patrón
      `nextjs_space/src/lib/document-generator/formatos-snapshots/*` con
      negation `!nextjs_space/src/lib/document-generator/formatos-snapshots/.gitkeep`.
      Resultado: los 10 binarios quedan ignorados; el `.gitkeep` se preserva
      en tracking.
- [ ] **AC-11** Después del sync + `npm test`, el reporte es **exactamente**:
      `Tests  719 passed | 0 failed | 8 skipped (727)`. **Verificado
      empíricamente** en este entorno con todos los 4 archivos del corte
      modificados: `Test Files  50 passed (50); Tests  719 passed | 8 skipped (727); Duration  222.53s`.
- [ ] **AC-12** Commit único: solo toca `nextjs_space/nextjs_space/scripts/`,
      `nextjs_space/nextjs_space/vitest.config.mjs`, y
      `nextjs_space/nextjs_space/.gitignore`. Cero diff en `src/lib/document-generator/**`,
      cero diff en `nextjs_space/nextjs_space/docs/specs/` (el spec va en
      commit administrativo aparte), cero diff en `nextjs_space/nextjs_space/AGENTS.md`,
      cero diff en `nextjs_space/nextjs_space/package.json` / `package-lock.json`.
- [ ] **AC-13** El wiring del globalSetup va en commit propio (no se mezcla
      con el spec/log de cierre).
- [ ] **AC-14** El test AUSENCIA en `tests/verifiers/document-render.spec.ts:276`
      (`"AUSENCIA → FILLER_THREW (PDF no implementado)"`) lleva un comentario
      inline de 2-3 líneas justo encima explicando:
      - Que `ausenciaFiller` es un stub que lanza `AUSENCIA_FILLER_NOT_IMPLEMENTED`.
      - Que el test verifica el path de error (`renderDocument` convierte el
        throw del filler en `{ ok: false, code: "FILLER_THREW" }`).
      - Que pre-sync fallaba por falta de snapshot (falsa falla); post-sync
        pasa correctamente.
      - Que cuando AUSENCIA-F2 implemente el filler (puppeteer / pdf-lib /
        reemplazo docx), este test debe ser actualizado o eliminado porque
        el código de error ya no será `FILLER_THREW`.

      **NO** se usa `it.fails` (decidido tras verificación empírica
      2026-10-12): con el sync cableado, el test pasa naturalmente porque el
      stub lanza correctamente y `renderDocument` lo mapea a `FILLER_THREW`.
      `it.fails` exigiría que el test fallara, contradiciendo el estado real.
      Verificado: si se usa `it.fails`, vitest aborta con "Expect test to fail"
      porque el test inside pasa.
- [ ] **AC-15** El script `scripts/sync-formatos-snapshots.mjs` lleva, al
      inicio del archivo, un bloque JSDoc que documenta explícitamente los
      DOS esquemas de nombres (§R8) y termina con un comentario `// DO NOT
      UNIFY — see docs/specs/audit-formatos-snapshots-wiring.md`. Mínimo
      8 líneas de comentario.

---

## 3. Edge Cases / Riesgos

### Riesgos del comando

- **R1 (mtime no portable):** la comparación idempotente usa `size + mtime`.
  En filesystems con mtime granularidad baja (FAT32, SMB legacy) podría haber
  falsos negativos. Si `npm test` se queja, fallback a size-only.
  Mitigación: usar siempre la misma fuente (`FS` source) y mtime del destino
  escrito por el mismo script.
- **R2 (sync cost en cada `npm test`):** vitest globalSetup corre en cada
  invocación. La idempotencia size+mtime evita el costo de copia cuando nada
  cambió. Si la fuente es remota / lenta, considerar cache longer-lived en
  futuro. Por ahora, OK.
- **R3 (env var `FORMATOS_DIR` apuntando a dir equivocado):** si el dev
  define `FORMATOS_DIR` apuntando a un directorio sin los 10 archivos
  esperados, el script copiará 0 archivos y avisará del mapeo incompleto.
  El suite mostrará entonces los 34 ENOENT — comportamiento aceptable,
  diagnóstico claro. No aceptamos `process.env.FORMATOS_DIR` apuntando a algo
  fuera del repo (no validamos, pero el diseño NO impone ese límite).
- **R4 (cambio de nombre de archivo en `FORMATOS/` por el área legal):** el
  warning explícito (AC-5) detecta esto. Si el dev ve un warning "unmapped",
  sabe que la tabla de mapeo necesita actualización. Es una guía de
  mantenimiento, no un bloqueante (el sync sigue copiando 10 archivos +
  warnings).
- **R5 (conflict entre `globalSetup` de vitest y otro `globalSetup` que se
  añada en el futuro):** vitest permite múltiples globalSetup files en
  array. Si en el futuro se añade otro script, se concatena. No es bloqueante
  hoy.
- **R6 (race condition en primer commit + sync):** vitest globalSetup corre
  UNA vez al inicio de la suite, antes de los workers. No hay condición de
  carrera interna.
- **R7 (coverage script `scripts/_test-parse.mjs`):** el sync copia binarios
  ~1.4 MB en `formatos-snapshots/`. Estos viven en `.gitignore` (AC-10).
  Sin embargo, vitest tiene `include: ["tests/verifiers/**/*.spec.{ts,tsx}"]`
  — los binarios no entran a la suite de tests, así que no hay overhead de
  cobertura.
- **R8 (footgun de naming convention — CRÍTICO, documentar para futuro):**
  existen DOS esquemas de nombres para las plantillas que conviven:

  - **`FORMATOS/`** usa nombres largos del área legal:
    `"3.5. FORMATO OC_ ORDEN DE COMPRA.xlsx"`,
    `"CONTRATO DE TRABAJO A TÉRMINO INDEFINIDO.docx"`,
    `"V1-OBRA-PRECIO GLOBAL.docx"`, etc. Son **authoritativos**: los pone
    el área legal/contractual y NO se renombran (ver `render.ts:130` y
    `TEMPLATE_FILE` que los lee tal cual).
  - **`formatos-snapshots/`** usa nombres canónicos cortos que esperan
    los tests: `"OC.xlsx"`, `"CONT_LABORAL.docx"`, `"CONT_GLOBAL.docx"`,
    etc. (definidos en `document-render.spec.ts:22-31` y en el
    `templateBytes` lookup de cada filler).
  - **El script de sync es el ÚNICO traductor entre ambos esquemas**:
    lee del source (FORMATOS) con nombre largo, copia al destino
    (snapshots) con nombre canónico via `NAME_MAP`.

  **Por qué es footgun:** alguien (dev futuro, agente, o el área legal) va
  a "unificar" los nombres — o renombrando los binarios de FORMATOS a
  cortos (rompe el source-of-truth que el `TEMPLATE_FILE` en
  `render.ts:130` espera), o renombrando los de snapshots a largos
  (rompe los 10 expects de los tests). Cualquier unificación rompe uno de
  los dos lados.

  **Mitigación obligatoria (AC-15):** el script DEBE tener un bloque de
  comentario JSDoc al inicio del archivo explicando los dos esquemas y la
  razón del mapeo, con un `// DO NOT UNIFY` explícito. El spec §4.1 debe
  referenciar ese JSDoc.

### Estados a evitar explícitamente

- **NUNCA** commitear los 10 binarios a git (van gitignoreados).
- **NUNCA** hacer fallback silencioso cuando `FORMATS_DIR` no existe — siempre abort.
- **NUNCA** modificar el formato / parseo de `OC.xlsx` ni de los archivos
  fuente (esos los maneja el área legal). El script solo copia.
- **NUNCA** ejecutar el sync desde un commit que aún no commitea el wiring de
  `globalSetup` — orden importa.

---

## 4. Technical Contract

### 4.1 Patch esperado en `scripts/sync-formatos-snapshots.mjs`

**Bloque JSDoc obligatorio al inicio del archivo** (cumplir AC-15, mitigar R8):

```js
/**
 * scripts/sync-formatos-snapshots.mjs
 *
 * =====================================================================
 * ⚠️  DO NOT UNIFY NAMING — DOS ESQUEMAS CONVIVEN A PROPÓSITO  ⚠️
 * =====================================================================
 *
 * SCHEMA 1 (Source, autoritativo): FORMATOS/
 *   Nombres largos del área legal/contractual:
 *     "3.5. FORMATO OC_ ORDEN DE COMPRA.xlsx"
 *     "CONTRATO DE TRABAJO A TÉRMINO INDEFINIDO.docx"
 *     "V1-OBRA-PRECIO GLOBAL.docx"
 *   Estos nombres son el source-of-truth. Los lee `render.ts:130`
 *   (TEMPLATE_FILE) para resolver la ruta real de cada templateId en
 *   producción. NO SE RENOMBRAN: el área legal/contractual los gestiona.
 *
 * SCHEMA 2 (Destination, derivado): src/lib/document-generator/formatos-snapshots/
 *   Nombres canónicos cortos que esperan los tests:
 *     "OC.xlsx", "CONT_LABORAL.docx", ...
 *   Definidos en document-render.spec.ts:22-31 y en el `load(name)`
 *   de cada spec de filler.
 *
 * ESTE SCRIPT ES EL ÚNICO TRADUCTOR ENTRE LOS DOS ESQUEMAS vía NAME_MAP.
 *
 * POR QUÉ EXISTEN DOS ESQUEMAS:
 *   - El área legal usa nombres con prefijo "3.X. " o "V<n>-" para ordenar
 *     en su sistema de archivos y reflejar la versión del formato.
 *   - Los tests usan nombres cortos porque referencian el templateId
 *     semántico (OC, LEG, etc.) en vez del nombre del archivo.
 *
 * ⚠️  NUNCA "unifiques" los nombres:
 *   - Renombrar en FORMATOS/ rompe `render.ts:130` (TEMPLATE_FILE).
 *   - Renombrar en formatos-snapshots/ rompe los expects de los tests.
 *   Si alguien intenta unificar, revertir y referenciar este archivo.
 *
 * Spec: docs/specs/audit-formatos-snapshots-wiring.md §R8, §AC-15.
 * =====================================================================
 */
```

Estructura nueva (no diff exacto porque es reescritura significativa):

```js
// Resolución de FORMATS_DIR con fallback chain
function resolveFormatsDir(projectRoot) {
  if (process.env.FORMATOS_DIR && existsSync(process.env.FORMATOS_DIR)) {
    return { dir: process.env.FORMATOS_DIR, source: "env:FORMATOS_DIR" };
  }
  const candidates = [
    path.resolve(projectRoot, "..", "..", "FORMATOS"),
    path.resolve(projectRoot, "..", "Formatos"),
    path.resolve(projectRoot, "..", "..", "..", "FORMATOS"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return { dir: c, source: `fallback:${c}` };
  }
  return null;  // → hard-fail en syncSnapshots()
}

// Mapeo source → canonical
const NAME_MAP = {
  "3.2. AD-0033- SOLICITUD DE ANTICIPO.xlsx": "AD-0033.xlsx",
  "3.3. FORMATO DE LEGALIZACIÓN O REINTEGRO.xlsx": "LEG.xlsx",
  "3.5. FORMATO OC_ ORDEN DE COMPRA.xlsx": "OC.xlsx",
  "3.6. FORMATO OS_ ORDEN DE SERVICIO.xlsx": "OS.xlsx",
  "3.7. FORMATO DE CORTE Y MEMORIAS DE OBRA_1.xlsx": "CORTE.xlsx",
  "3.9. FORMATO AUSENCIA LABORAL[1].pdf": "AUSENCIA.pdf",
  "CONTRATO DE TRABAJO A TÉRMINO INDEFINIDO.docx": "CONT_LABORAL.docx",
  "CONTRATO DISEÑOS.docx": "CONT_DISENOS.docx",
  "V1-OBRA-PRECIO GLOBAL.docx": "CONT_GLOBAL.docx",
  "V2-MODELO OBRA-PRECIO UNITARIO.docx": "CONT_UNITARIO.docx",
};

const EXTS = new Set([".xlsx", ".docx", ".pdf"]);

async function syncSnapshots({ dryRun = false, log } = {}) {
  const projectRoot = ...;
  const formats = resolveFormatsDir(projectRoot);
  if (!formats) {
    // Hard-fail con mensaje claro (AC-9)
    console.error(formatAbortMessage(candidates));
    process.exit(1);
  }
  // Para cada archivo en formats.dir:
  //   - Si ext no está en EXTS, skip
  //   - Si sourceName no está en NAME_MAP, log warning (AC-5)
  //   - dst = path.join(SNAPSHOTS_DIR, NAME_MAP[sourceName])
  //   - Comparar dst size+mtime vs source; si igual, skipped++ ; si dif, copied++
  //   - Si dryRun, no escribir pero reportar
  // Output final:
  //   human (CLI): "✅ copied=N skipped=M warnings=K dir=..."
  //   short (globalSetup): "sync: copied=N skipped=M warnings=K"
}

if (isMain) {
  const dryRun = process.argv.includes("--dry-run");
  const result = await syncSnapshots({ dryRun });
  // print output
}
```

### 4.2 Patch esperado en `vitest.config.mjs`

```diff
   test: {
     globals: true,
     environment: "jsdom",
     setupFiles: ["./tests/setup.ts"],
+    globalSetup: ["./scripts/sync-formatos-snapshots.mjs"],
     include: ["tests/verifiers/**/*.spec.{ts,tsx}"],
     cache: false,
     ...
   },
```

### 4.3 Patch esperado en `.gitignore`

```diff
   # Plantillas reales de /Formatos (binarios pesados, no se commitean)
   /Formatos/
   /Formatos/**/*
+
+  # Snapshots sincronizados desde /Formatos (ver docs/specs/audit-formatos-snapshots-wiring.md)
+  # Solo .gitkeep se preserva; el resto son binarios efímeros por máquina.
+  nextjs_space/src/lib/document-generator/formatos-snapshots/*
+  !nextjs_space/src/lib/document-generator/formatos-snapshots/.gitkeep
```

### 4.4 Comando exacto

```
cd "D:\desarrollos\ControlObra\ControlObra\nextjs_space\nextjs_space"
# Editar scripts/sync-formatos-snapshots.mjs según §4.1
# Editar vitest.config.mjs según §4.2
# Editar .gitignore según §4.3
# Verificar dry-run:
node scripts/sync-formatos-snapshots.mjs --dry-run
# Verificar ejecución real (sincroniza los 10 archivos):
node scripts/sync-formatos-snapshots.mjs
# Verificar idempotencia (segunda corrida = 0 cambios):
node scripts/sync-formatos-snapshots.mjs
# Verificar tests:
npm test
# Verificar ausencia de tracking:
git -C ".../nextjs_space" status --short  # (no deben aparecer los binarios como untracked)
git -C ".../nextjs_space" check-ignore -v nextjs_space/src/lib/document-generator/formatos-snapshots/OC.xlsx  # → confirma gitignore
```

---

## 5. Dependencies

### Files to Modify
- `nextjs_space/nextjs_space/scripts/sync-formatos-snapshots.mjs` (re-write
  significativa, manteniendo la firma `syncSnapshots()`).
- `nextjs_space/nextjs_space/vitest.config.mjs` (añade `globalSetup`).
- `nextjs_space/nextjs_space/.gitignore` (añade patrones).

### Files to Create
- `nextjs_space/nextjs_space/docs/specs/audit-formatos-snapshots-wiring.md` (este spec).

### Files explicitly NOT touched
- `nextjs_space/nextjs_space/src/lib/document-generator/**` (código de los
  fillers, xlsx-helpers, render — todo intacto).
- `nextjs_space/nextjs_space/src/lib/excel-parser.ts` (Corte 3 — NO).
- `nextjs_space/nextjs_space/src/lib/xlsx-helpers.ts` (Corte 3 — NO).
- `nextjs_space/nextjs_space/next.config.mjs`, `eslint.config.mjs`,
  `tailwind.config.ts`.
- `nextjs_space/nextjs_space/package.json`, `package-lock.json`.
- `nextjs_space/nextjs_space/AGENTS.md` (log de fase va en commit aparte).
- `FORMATOS/` (la carpeta fuente — no se toca).

### Si el sync introduce un cambio no esperado
- Cualquier archivo en `formatos-snapshots/` debe coincidir byte-a-byte con
  el source. Si difiere, abortar.

---

## 6. Verifier Plan

### 6.1 Pre-cambio

```
# Confirmar baseline pre-cambio (sigue siendo 685 + 34 + 8):
cd nextjs_space/nextjs_space && NODE_OPTIONS="--max-old-space-size=4096" npm test
# esperado: Test Files 5 failed | 45 passed (50); Tests 34 failed | 685 passed | 8 skipped (727)

# Confirmar que FORMATOS existe:
Test-Path "D:\desarrollos\ControlObra\ControlObra\FORMATOS"
# esperado: True

# Confirmar que globalSetup NO está wireado actualmente:
grep "globalSetup" nextjs_space/vitest.config.mjs
# esperado: 0 matches
```

### 6.2 Post-cambio (orden estricto)

| # | Comando | Criterio de éxito |
|---|---|---|
| V1 | `node scripts/sync-formatos-snapshots.mjs --dry-run` | Salida línea-por-línea de los 10 archivos con destino canónico; summary `copied=10, skipped=0, warnings=0`. Sin tocar filesystem. |
| V2 | `node scripts/sync-formatos-snapshots.mjs` | Imprime al final `✅ sync-formatos-snapshots: copied=10 skipped=0 warnings=0`. Los 10 archivos en `formatos-snapshots/`. |
| V3 | `node scripts/sync-formatos-snapshots.mjs` (segunda corrida) | `copied=0 skipped=10`. Idempotencia funciona (size+mtime match). |
| V4 | `ls -la src/lib/document-generator/formatos-snapshots/` | 10 archivos + `.gitkeep`. Sin archivos extraños. |
| V5 | `npm test` | Tests: **719 passed + 0 failed + 8 skipped** (727 total). Sin warnings de Vite. AUSENCIA test pasa naturalmente porque el stub lanza correctamente (AC-14). El bucket `expected fail` NO existe en el reporter (no se usa `it.fails`). |
| V6 | `git -C ".../nextjs_space" check-ignore -v nextjs_space/src/lib/document-generator/formatos-snapshots/OC.xlsx` | Imprime la línea de .gitignore. Confirma que el binario está ignorado. |
| V7 | `git -C ".../nextjs_space" status --short \| Select-String formatos-snapshots` | Vacío o solo `.gitkeep`. Sin binarios untracked. |
| V8 | `git -C ".../nextjs_space" diff --stat nextjs_space/package.json nextjs_space/package-lock.json nextjs_space/next.config.mjs nextjs_space/eslint.config.mjs nextjs_space/src/ nextjs_space/tailwind.config.ts` | Sin cambios en estos paths. |
| V9 | Revisión manual del comentario inline en `document-render.spec.ts:276` | 4-5 líneas sobre AUSENCIA test (stub `ausenciaFiller` lanza, test verifica FILLER_THREW, pre-sync era falsa falla, AUSENCIA-F2 update). |
| V10 | Parsing de la última línea `Tests  N passed \| N failed \| N skipped (total)` de la salida V5 | Estructura exacta: `Tests  719 passed | 8 skipped (727)`. Sin bucket `expected fail`. |

### 6.3 Smoke test del commit principal (no debug)

Una vez commit + push, validar en prod (Hostinger) que la app sigue corriendo
sin efectos colaterales: el globalSetup solo se ejecuta en `npm test`, no en
`next build` ni en producción. No hay regresión funcional esperada.

---

## 7. Estrategia de commits (aislamiento)

| # | Mensaje | Archivos |
|---|---|---|
| 1 | `fix(test): wire formatos-snapshots sync + resolve FORMATOS_DIR + gitignore binarios` | `scripts/sync-formatos-snapshots.mjs`, `vitest.config.mjs`, `.gitignore` |
| 2 | `docs(specs): spec wiring sync-formatos-snapshots + log AGENTS.md` | `docs/specs/audit-formatos-snapshots-wiring.md`, `AGENTS.md` |

> **Push:** `origin/main`, branch `main`, commits individuales
> (`git add` por archivo, NO `git add -A`).

### Mensajes exactos aprobados por el usuario
- Commit 1: el de arriba.
- Commit 2: el de arriba.

---

## 8. Out of Scope

- Modificar nombres en `FORMATOS/` (lo maneja el área legal).
- Commitear los 10 binarios al repo.
- Migración de `xlsx` (Corte 3).
- Upgrade de `@azure/msal-node` (Corte 4).
- Modificar `src/lib/document-generator/**`.
- Crear un script de backup para `FORMATOS/`.
- Documentación en `docs/procesos/` sobre este wiring.
- Hook de git pre-commit que corra el sync (no existe — se mantiene simple).

---

## 9. Plan de Aborto

**Cancelar el commit principal y reportar si se cumple CUALQUIERA de:**

- **A1:** `FORMATOS_DIR` no se encuentra en ninguna ruta del fallback chain.
- **A2:** Después del sync, `ls formatos-snapshots/` muestra menos de 10
  archivos canónicos (alguno faltó o se nombró mal).
- **A3:** Después del sync, hay archivos en `formatos-snapshots/` cuyo nombre
  no está en la lista de los 10 canónicos definidos en `NAME_MAP`.
- **A4:** V5 (npm test) reporta **< 719 passing** o **> 0 failing**.
- **A5:** Después del sync, `git status --short | grep formatos-snapshots`
  muestra los binarios como `untracked` (gitignore no funcionó).
- **A6:** El sync produce archivos cuyo SHA difiere byte-a-byte del source.
- **A7:** El sync modifica otros paths fuera de `formatos-snapshots/`.
- **A8:** Cualquier cambio en `src/lib/document-generator/**`,
  `package.json`, `package-lock.json`, `next.config.mjs`, o `eslint.config.mjs`.

**Si A1 o A2 ocurre:** antes de abortar, correr
`node scripts/sync-formatos-snapshots.mjs --dry-run` para confirmar el
diagnóstico. Si el problema es estructural (Falta /FORMATOS/), pedir al
usuario restaurar la copia que tenía. NO se acepta "skip" como workaround.

---

## 10. Approval

**Status:** ⏳ Pending Review

> Adiciones respecto a la versión inicial (no negociables porque son
> correcciones del usuario, no sugerencias mías):
> - **AC-14:** Comentario inline obligatorio en el AUSENCIA test (4-5
>   líneas justificando el comportamiento).
> - **AC-15:** JSDoc obligatorio en el script explicando los dos esquemas de
>   nombres + warning `DO NOT UNIFY`. Cubre R8 (footgun de naming convention)
>   que ocurriría tarde o temprano si no se documenta.
>
> ### Verificación empírica (2026-10-12) — baseline confirmado
>
> Antes de fijar el AC-11, realicé dos corridas de `npm test` para verificar
> el comportamiento del reporter. La historia tuvo 3 hitos:
>
> **Hito 1 — Pre-sync (snapshot AUSENCIA.pdf no existe):**
> `Tests  34 failed | 685 passed | 8 skipped` — AUSENCIA fallaba con
> `TEMPLATE_FILE_MISSING` (snapshot faltante, no por el stub).
>
> **Hito 2 — Post-sync + AUSENCIA en `it.fails` (mi suposición original):**
> `Tests  33 failed | 685 passed | 1 expected fail | 8 skipped` —
> Hallazgo: Vitest 5 reporta `it.fails` en bucket separado "expected fail".
> Corre spec a `718 passed + 0 failed + 1 expected fail + 8 skipped`.
>
> **Hito 3 — Post-sync + AUSENCIA en plain `it` (lo que realmente hay):**
> `Tests  719 passed | 8 skipped` — el AUSENCIA test ahora PASA porque
> el stub `ausenciaFiller` lanza correctamente y `renderDocument` lo
> captura como `{ ok: false, code: "FILLER_THREW" }`. La aserción
> `expect(err(r).code).toBe("FILLER_THREW")` se cumple.
>
> Conclusión: **`it.fails` no es necesario.** El AUSENCIA test es válido
> como `it` post-sync. AC-11 regresa a `719 passed + 0 failed + 8 skipped`.
> AC-14 se resignifica: ya no es "usar `it.fails`" sino "comentario inline
> explicando el path de error y la transición AUSENCIA-F2". El spec
> documenta este viaje en §10 para que el próximo agente no repita la
> confusión.
>
> ### Patrón a recordar (cross-corte y cross-proyecto)
>
> Antes de fijar un baseline de tests, **verificar empíricamente** cómo el
> reporter del framework cuenta cada bucket (passed/failed/expected-fail/
> skipped). NO asumir. El baseline `719/0/8` original era correcto DESPUÉS
> del sync; añadir `it.fails` lo desvirtuaba. Sin la verificación habríamos
> aprobado un spec mintiendo sobre `718/0/1/8` durante meses.
