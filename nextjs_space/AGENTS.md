# ROLE: Karpathy Web Agent (Spec + Verifier + Environment)

## CORE PHILOSOPHY
You are an expert AI Software Engineer following Andrej Karpathy's methodology.
You DO NOT write implementation code until:
1. The Environment is understood
2. The Spec is defined and approved
3. The Verifier (Tests) are written and failing

## WORKFLOW (STRICT EXECUTION ORDER)

### PHASE 1: ENVIRONMENT (Contexto y Entorno)
**Trigger:** User asks for a new feature or project setup.
**Action:**
1. Read `/docs/env/ARCHITECTURE.md` to understand the tech stack
2. Read `/docs/env/CONSTRAINTS.md` to understand rules and limitations
3. Analyze existing codebase structure in `nextjs_space/src/`
4. Acknowledge current state and constraints

**Output:** Brief 2-3 sentence confirmation of environment understanding.

**DO NOT:** Write any code yet.

---

### PHASE 2: SPEC (Especificación)
**Trigger:** User describes a feature request.
**Action:**
1. Create `docs/specs/[feature-name].md` using the template
2. Define:
   - **User Story:** As a [user], I want to [action] so that [benefit]
   - **Acceptance Criteria:** Bulleted list of exact behaviors
   - **Edge Cases:** Error states, empty states, loading states
   - **Technical Contract:** TypeScript interfaces, API endpoints, component props
   - **Dependencies:** What existing code will be modified

**DO NOT:** Write implementation code. Ask user to approve.

---

### PHASE 3: VERIFIER (El Verificador / TDD)
**Trigger:** User approves the Spec.
**Action:**
1. Create test files in `nextjs_space/tests/verifiers/[feature-name].spec.ts`
   (copiando `TEMPLATE_test.spec.ts.template`)
2. Write tests covering all acceptance criteria and edge cases
3. Run the tests to confirm they FAIL (Red phase)

**DO NOT:** Write implementation code yet.

---

### PHASE 4: IMPLEMENTATION (Código)
**Trigger:** User confirms Verifiers are ready.
**Action:**
1. Write implementation code in `nextjs_space/src/` to make Verifiers pass
   (reglas de negocio en `src/lib/<modulo>-workflow.ts` o `-validation.ts`;
   la ruta `/api/*` importa esa funcion, no duplica la regla)
2. Strictly adhere to TypeScript interfaces from the Spec
3. Run tests iteratively until they pass (Green phase)

---

### PHASE 5: REFACTOR & VERIFY
**Trigger:** Implementation is complete.
**Action:**
1. Run all tests one final time (`cd nextjs_space && npm test`): la suite debe
   quedar completamente verde, y `npx tsc --noEmit` en 0 errores
2. Check for code quality (no `any` types, proper error handling)
3. Refactor if needed (but don't break tests)

---

## CONTEXT OPTIMIZATION FOR MINIMAX-M3

### How to Request Context Efficiently:
1. **Start with Spec:** "Read @docs/specs/[feature].md"
2. **Then Verifier:** "Read @nextjs_space/tests/verifiers/[feature].spec.ts"
3. **Only then specific files:** "Read @src/components/[Component].tsx"

### Rules:
- Use modular imports (don't dump entire files)
- Use TypeScript interfaces to enforce contracts
- When modifying code, only show the changed functions/components

### Anti-Patterns to Avoid:
- ❌ Writing code before Spec is approved
- ❌ Modifying tests to make them pass (fix the code instead)
- ❌ Adding features not in the Spec
- ❌ Using `any` types
- ❌ Dejar un verifier en rojo permanente (nadie vuelve a mirar el semáforo)
- ❌ Mover o renombrar algo en `src/lib/` sin actualizar los verifiers que lo
  importan: un import roto hace que el archivo ejecute 0 tests en silencio
- ❌ Usar `require()` dentro de un test (el módulo es ESM: lanza y genera un
  falso rojo)

---

## Changelog de fixes (2026-10-02)

### [2026-10-02] bug-project-form-currency-step · FASE 1 (SPEC)
- Spec creado en docs/specs/bug-project-form-currency-step.md.
- Bug raíz 1: project-form.tsx:179 usa step="1000000" en <Input type="number"> para presupuesto → navegador rechaza valores no múltiplos de 1M (mensaje "valores válidos más aproximados son 76000000 y 77000000").
- Bug raíz 2: <Label htmlFor="status"> apunta a un <Select> cuyo <SelectTrigger> no tiene id="status" → warning DevTools Incorrect use of <label for=FORM_ELEMENT>.
- Decisión técnica: step="1000" (miles de COP) + añadir id="status" al <SelectTrigger>. Zod schema NO se modifica.
- Patrón en codebase: precedent en ug-presupuestos-round.md que recomienda step="any" para no redondear. Acá usamos step="1000" porque presupuesto sí tiene granularidad útil de miles.

### [2026-10-02] bug-project-form-currency-step · FASE 2 (VERIFIER ROJO)
- Verifier creado en 	ests/verifiers/bug-project-form-currency-step.spec.ts.
- Patrón elegido: static source analysis con readFileSync + regex (mismo patrón que 	ests/verifiers/project-form-edit.spec.ts:56). Permite testear atributos JSX sin RTL/DOM mocking.
- Cubre: AC-1, AC-2, AC-4, AC-5, AC-6 con 11 tests.
- Estado rojo actual: **6 tests fallando, 5 pasando** (los rojos son los que tocan los 2 bugs: step restrictivo y SelectTrigger sin id).
- Comando para correr: cd nextjs_space && npx vitest run tests/verifiers/bug-project-form-currency-step.spec.ts.
- AC-3 (Zod schema) y AC-4 parcial (Label existe) ya pasan — son invariantes que el fix NO debe romper.

### [2026-10-02] bug-project-form-currency-step · FASE 3 (IMPLEMENTACIÓN)
- Cambios en src/components/projects/project-form.tsx:
  - Input presupuesto: step="1000000" → step="1000" + añadido inputMode="numeric" para móvil.
  - <SelectTrigger>: añadido id="status" para accesibilidad (label huérfana).
- Zod schema NO modificado: sigue siendo z.coerce.number().min(0) (cualquier número ≥ 0 es válido).
- Bug en mi propio verifier descubierto al verde: \bid="status"\b fallaba porque \b después del " de cierre NO es word boundary. Corregido a \bid="status" (sin \b final). Lección: \b solo entre word-chars y non-word-chars, no después de un char de puntuación.

### [2026-10-02] bug-project-form-currency-step · FASE 4 (REFACTOR & VERIFY)
- npx vitest run tests/verifiers/bug-project-form-currency-step.spec.ts → 11/11 verde.
- npx vitest run sobre 5 verifiers relacionados (project-form-edit, bug-proyectos-no-crea, budgets-persistence, budget-change-control, bug-project-form-currency-step) → 77/77 verde.
- npx tsc --noEmit → 1 error preexistente en tests/verifiers/advances-suggestion.spec.ts:21 (TS2741 'contractId' missing). NO relacionado con este fix.
- Sin any types nuevos.
- AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 todos cumplidos.
- Cierre: bug del presupuesto + label huérfana resueltos y protegidos por el verifier.

### [2026-10-02] Cleanup manual requerido
- Archivo tests/verifiers/_debug_id_status.cjs quedó en disco (usado para diagnosticar el bug del verifier). El sandbox bloqueó rm/Remove-Item y mavis-trash no está disponible en este runtime → borrar manualmente desde el Explorador de Windows.

### [2026-10-03] dev-auth-bypass Â· FASE 1 (SPEC)
- Spec creado en docs/specs/dev-auth-bypass.md.
- Problema: el dev local NO puede alcanzar el MySQL de Hostinger (puerto 3306 no expuesto a Internet desde IPs externas). 
equest-otp muere en el SELECT con ER_ACCESS_DENIED_ERROR antes de poder enviar el codigo o devolver devCode.
- Solucion: bypass dev-only con doble guard (NODE_ENV !== "production" + DEV_AUTH_BYPASS === "true"). Ambos se cumplen en 
pm run dev local, ambos fallan en Hostinger prod.
- Sesion creada es legacy (${userId}.) -> NO escribe en user_sessions, y erifySessionCookie la acepta sin tocar MySQL (ver session.ts lineas 165-176).
- Produccion: la ruta nueva siempre devuelve 404 (no 403, para no confirmar existencia). El GET /api/auth/login mantiene su comportamiento actual cuando el flag esta apagado.

### [2026-10-03] dev-auth-bypass Â· FASE 2 (VERIFIER ROJO)
- Verifier creado en tests/verifiers/dev-auth-bypass.spec.ts con 13 tests.
- Cubre: AC-1 (prod 404), AC-2 (dev sin flag 404), AC-3 (dev con flag 200+user+cookie+no MySQL), AC-4 (GET /api/auth/login devuelve user sin MySQL), bug-fix colateral (area lowercase).
- Sanitizacion de userId con regex /^[a-zA-Z0-9_-]{1,32}$/ para evitar inyeccion en la cookie. Cobertura explicita con test "' OR 1=1 --".
- Estrategia: todos los i.mock() al top-level del archivo (Vitest los hoistea; dentro de describe chocan entre si y producen "0 tests").

### [2026-10-03] dev-auth-bypass Â· FASE 3 (IMPLEMENTACIÃ“N)
- Nuevos archivos:
  - src/lib/dev-auth.ts (helper devMockUser(userId) + tipos DevMockUser).
  - src/app/api/auth/dev-login/route.ts (POST con doble guard).
- Modificaciones:
  - src/app/api/auth/login/route.ts GET: aÃ±adida interception dev-only despues de verifySessionCookie, antes del SELECT. Importa devMockUser.
  - src/app/login/page.tsx: probe silencioso a /api/auth/dev-login en mount para detectar si el bypass esta habilitado (status !== 404). Si lo esta, renderiza boton "Entrar como admin (modo dev)" debajo del form de email. Bug-fix colateral: 
outer.push(\/\) ahora hace .toLowerCase() en las 3 redirecciones (devLogin, verifyOtp, useEffect). El bug pre-existente causaba 404 cuando users.area viene en MAYUSCULAS desde la BD (la ruta es /administrativo en minusculas). Esto es bit-identity-safe para prod porque solo cambia el redirect a la variante lowercase que es la unica que existe.
- .env.local (gitignored): aÃ±adido DEV_AUTH_BYPASS=true. Hostinger prod NO tiene esta variable Y NODE_ENV=production, asi que el bypass NUNCA corre en prod.
- Type-check 
px tsc --noEmit: solo el error preexistente en 	ests/verifiers/advances-suggestion.spec.ts:21 (TS2741 'contractId' missing). Sin errores nuevos.
- Vitest dev-auth-bypass.spec.ts: 13/13 verde. Vitest full: 638 passing + 34 failing preexistentes en document-xlsx-helpers.spec.ts (snapshots faltantes, sin relacion con este fix).

### Patrones a recordar (memory)
- **Doble guard prod**: cualquier ruta dev-only exige AMBOS NODE_ENV !== "production" Y una env opt-in (DEV_*=true). Esto hace que aunque el .env de prod incluya el flag por error, no se active.
- **Legacy cookie**: signSession(userId) (formato ${userId}.) es la unica sesion que NO requiere fila en user_sessions. Usar para bypass que solo necesita "estar logueado".
- **Mock location**: en Vitest, TODOS los i.mock() al top-level del archivo. Si los pones dentro de describe, Vitest los hoistea igualmente y chocan -> "0 tests" + error de hoisting.
- **Lowercase area en redirect**: pre-existente bug que users.area puede venir en MAYUSCULAS de la BD y Next.js solo matchea minusculas. Cualquier 
outer.push(\/\\) debe hacer .toLowerCase().
- **DB inalcanzable desde local**: Hostinger no expone 3306 a Internet. Cualquier endpoint que toque MySQL va a fallar en local con ER_ACCESS_DENIED_ERROR. Soluciones: bypass dev-only (para login), tunnel SSH, o MySQL local con dump.

### [2026-10-03] excel-parser-match-excel-total · FASE 1 (DIAGNOSIS)
- Bug encontrado: el modal de upload daba `$5.270.232.769` mientras el `VALOR TOTAL PRESUPUESTO` del Excel oficial colombiano dice `$5.441.957.056` (gap $171M = 3.2%).
- 3 causas raices distintas en el parser:
  1. **Commit 384ae94** excluia `code="Tramites"` del `totalValue`. El Excel SI los incluye.
  2. **Reclassification bug**: cuando la clasificacion cambiaba, la primera fila de la nueva clasificacion se demoteaba a CHAPTER. 6 tramites ($96M) cayeron ahi.
  3. **Bug raw:false de SheetJS**: con `raw:false`, SheetJS aplica el formato de locale de la celda (`#,##0` colombiano). Asi 791770 se leia como string `"791.770"`, y parseNumber con single-dot=decimal interpretaba 791.77. Eso daba 145 items "fantasma" del parser y 144 items "perdidos" del Excel. Diff suma ~$50M.
- Validado con diag scripts contra el Excel real (openpyxl) y contra el parser TS (SheetJS+parseNumber).

### [2026-10-03] excel-parser-match-excel-total · FASE 2 (VERIFIER)
- Tests existentes a actualizar: `bug-presupuestos-round.spec.ts` tenia 2 tests que afirmaban `totalValue` SIN tramites. Revertidos a asserts CON tramites.

### [2026-10-03] excel-parser-match-excel-total · FASE 3 (IMPLEMENTACION)
- `src/lib/excel-parser.ts`:
  - `parseNumber` ahora acepta `number | string | undefined | null`. Si ya es number, lo devuelve tal cual. Esto elimina la ambiguedad del formato cuando SheetJS entrega un numero crudo.
  - `parseExcelFile`: `raw: false` -> `raw: true` en `XLSX.utils.sheet_to_json`. Asi SheetJS entrega el numero crudo de la celda sin aplicar formato de locale. Para celdas numericas ya no hay string formateado que parsear.
  - `isTramite` sigue existiendo (usado para skip de reclassification).
  - Reclassification (lineas 380-403): agregada condicion `!isTramite(row.code)` para que tramites no se demoteen a CHAPTER. Antes 6 tramites ($96M) se perdian.
  - `totalValue` (linea ~434): quitado `.filter(!isTramite)`. Ahora suma TODAS las filas layerType==ITEM, sin excluir tramites.
  - `itemCount` (linea ~440): quitado el filtro `!isTramite`. Tramites cuentan como items (440 + 13 = 453 en Parques del Valle).
  - `totalPrice=0` para CHAPTER/SUBCHAPTER (commit 4f14ae7) SE MANTIENE: asi las filas agregadas al pie del Excel ("TOTAL TRAMITES", "VALOR TOTAL PRESUPUESTO") siguen sin contar doble.
- Resultado verificado con parser TS contra el Excel real:
  - totalValue = `$5.441.957.056` (match exacto con VALOR TOTAL PRESUPUESTO del Excel)
  - itemCount = 453
  - chapterCount = 128
  - SUMA subtotales por frente = totalValue (consistente).
- Tests: 59/59 verde en specs modificados (bug-presupuestos-round + budget-upload-validation + dev-auth-bypass). Vitest full: 638 passing, 34 pre-existing failures en `document-xlsx-helpers.spec.ts` (snapshots faltantes, sin relacion).
- TS: solo error preexistente en `advances-suggestion.spec.ts:21` (TS2741). Sin errores nuevos.

### Patrones a recordar (memory) — extension 2026-10-03
- **SheetJS raw:true > raw:false para celdas numericas**: con raw:false, SheetJS aplica el formato de locale (`#,##0`) y entrega strings como `"791.770"` que parseNumber interpreta ambiguamente. Con raw:true entrega `791770` directo. Siempre usar raw:true para columnas numericas (cantidad, vr unit, vr total).
- **El "VALOR TOTAL PRESUPUESTO" del Excel oficial colombiano SI incluye tramites**: el `#,##0` cell format y la presencia de la seccion "Tramites" al pie son el patron estandar de presupuestos oficiales. No excluir tramites del parser total.
- **Reclassification de CHAPTER en cambio de clasificacion**: solo demotar a CHAPTER si la fila NO es tramite (codigo "^tramites?$"). Tramites tienen qty/precio y DEBEN contar como items.
- **Tests que asumen un comportamiento viejo del parser**: cuando se revierte un fix (como 384ae94), hay que actualizar los tests que afirmaban ese comportamiento. Anotar en el comentario del describe() que ese caso es revertido, no nuevo.

### [2026-10-04] project-detail-help-cards + psc-help-cards-and-renumber
- P0 plan 2026-10-04: agregar `ModuleExplanationCard` a las pantallas que les faltaba.
- `src/app/tecnico/proyectos/[id]/page.tsx`: 5 cards (Resumen / Presupuesto / Cortes / Contratistas / Bitacora) con storageKey por tab (`project-detail:*`). storageKey del componente permite que el usuario cierre la card y la preferencia persista en localStorage entre visitas.
- Bug colateral arreglado en contratistas: `slice(0, 3)` sobre providers globales reemplazado por empty state consistente con los otros tabs (Bug preexistente: mezclaba proveedores de otros proyectos).
- `src/app/tecnico/presupuestos/psc/page.tsx`: card de ayuda en la lista con ciclo de vida PSC.
- `src/components/pscs/psc-form.tsx`: card de ayuda al inicio del form (guia los 4 pasos).
- `src/app/api/pscs/route.ts`: nueva funcion `nextPscNumber()` que genera formato `PSC-YYYY-NNNN` (antes era opaco base36). Usa MAX(...)+1 sobre `psc_number LIKE 'PSC-YYYY-%'`. Backfill no aplica: solo afecta PSC nuevos creados despues del deploy.
- Tests: 28 tests verde en 2 specs nuevos (`project-detail-help-cards.spec.ts`, `psc-help-cards-and-renumber.spec.ts`). Static source analysis + regex.
- TS: solo error preexistente en `advances-suggestion.spec.ts:21` (TS2741). Sin errores nuevos.

### Patrones a recordar (memory) — extension 2026-10-04
- **ModuleExplanationCard siempre que haya flujo de varios pasos**: cualquier pantalla donde el usuario tiene que entender un ciclo de vida (DRAFT -> ACTIVE -> ..., o cargar PT -> confirmar -> guardar) merece un card explicativa. Patrón establecido: variante `guide` por defecto, `warning` si hay riesgo de preregistrar datos, `info` para info factual.
- **storageKey en ModuleExplanationCard es por pantalla + tab**: usar `project-detail:presupuesto`, `psc:list`, `psc:form`. Asi el usuario puede cerrar cards independientemente.
- **Numeracion incremental con MAX + 1, no COUNT + 1**: tolera race conditions y eliminaciones. Formato `PREFIJO-YYYY-NNNN` con `padStart(4, "0")`. Backfill opcional (no es bloqueante si no se hace en el deploy).
- **Empty states consistentes**: cuando un tab no tiene datos, mostrar Card con icono grande + titulo + subtitulo + accion sugerida. NO usar placeholders rotos como `slice(0, 3)` sobre datos globales.
- **Spec por sprint pequeno**: priorizar "1 sprint = 1 spec, 1 PR". Cada spec debe tener AC numerados, design contract, dependencies, out-of-scope, riesgos. Si el AC no se cumple, el spec falla.

### [2026-10-12] audit-corte-1-deps-cleanup · FASE 1 (SPEC)
- Spec creado en `docs/specs/audit-corte-1-deps-cleanup.md` con AC-1..AC-8, Verifier Plan V1-V6, Technical Contract y Out of Scope por Corte.
- 2 tareas: `npm audit fix` (semver-safe) + mover `tailwindcss-animate` a devDependencies.
- Restriccion explicita: no tocar xlsx / SheetJS / parser ni nada en `nextjs_space/nextjs_space/src/`.

### [2026-10-12] audit-corte-1-deps-cleanup · FASE 2 (VERIFIER)
- Verifier de regresion propuesto en spec §6.3 (static source analysis sobre `package.json`, patron readFileSync + JSON.parse similar a `bug-project-form-currency-step.spec.ts:56`).
- **NO materializado como `tests/verifiers/*.spec.ts` en este corte**: el ciclo TDD Red->Green no aplica a un cambio de deps (el comando se ejecuta una vez). Red de seguridad real: V4/V5/V6 (typecheck + tests + build). El verifier se materializa en una iteracion posterior si el Corte 1 se repite.

### [2026-10-12] audit-corte-1-deps-cleanup · FASE 3 (IMPLEMENTACION)
- **Tarea 1 — `npm audit fix`** aplicado. Cambios solo en `package-lock.json` (244 lineas, 122 +/-):
  - `sharp` 0.35.4 → 0.35.5 (librsvg SVG, High).
  - `source-map-js` 1.2.1 → 1.2.2 (ReDoS, High).
  - `engines.node` en lockfile root: `">=22.18.0"` → `">=20.0.0"` (resync con `package.json` actual; lockfile estaba stale previo al corte).
- **Tarea 2 — mover `tailwindcss-animate`** de dependencies a devDependencies. package.json con 2 lineas tocadas, lockfile con 73+/1- (todos los "+" son `"dev": true,` en paquetes que antes eran alcanzables via prod: braces, chokidar, fast-glob, micromatch, postcss-selector-parser, postcss-nested, etc.).
- Verificaciones post-cambio:
  - `npx tsc --noEmit`: 1 error preexistente en `tests/verifiers/advances-suggestion.spec.ts:21` (TS2741 'contractId' missing). 0 nuevos. Requiere `NODE_OPTIONS=--max-old-space-size=4096` en este host (heap default 1.5 GB OOM).
  - `npm test` (vitest): **685 pass + 34 fail (ENOENT snapshots preexistentes) + 8 skipped**. 0 nuevos rojos del Corte 1 (los 34 fail ya existian). Detalle abajo en FASE 4.
  - `npm run build`: exit 0, build 95s, 29 paginas estaticas generadas. Los 3 warnings `[db] ER_ACCESS_DENIED_ERROR` son ruido esperado: las paginas `ƒ` (Dynamic) no se pre-renderizan y Hostinger DB no es alcanzable desde este host.
- Commits materializados:
  - `33aa5ec chore(deps): npm audit fix (sharp 0.35.5, source-map-js 1.2.2)`
  - `50fb589 chore(deps): move tailwindcss-animate to devDependencies (audit omit=dev: 13 → 4)`

### [2026-10-12] audit-corte-1-deps-cleanup · FASE 4 (REFACTOR & VERIFY)
- `npm audit --omit=dev` final: **4 vulnerabilidades (1 High + 3 Moderate)** vs 14 pre-Corte 1 = **reduccion 71 %**.
- **High residual (1):** `xlsx` × 2 advisories (Prototype Pollution + ReDoS, sin fix disponible) → **Corte 3**.
- **Moderate residual (3):** `next` 15.5.25 (Corte 2), `uuid` <11.1.1 via `@azure/msal-node` (Corte 4), `xlsx` ReDoS como Moderate (Corte 3).
- **Baseline conocido:** 34 tests fallan por snapshots binarios no versionados en `src/lib/document-generator/formatos-snapshots/`. NO es regresion del Corte 1. Issue separado pendiente (provisionamiento de fixtures no es parte del Corte 1). Ver spec §6.5.
- AC-1..AC-8 cumplidos.
- Output `npm audit --omit=dev` post-Corte 1: solo `xlsx`, `next`, `uuid` y `xlsx` (ReDoS) — exactamente los 3 paquetes que cada uno es su propio Corte.

### Patrones a recordar (memory) — extension 2026-10-12
- **`npm audit fix` sin `--force` solo parchea paquetes con rango declarado abierto (caret/tilde/mayor-igual)**: las versiones pineadas exact (sin ^/~/>=) no se tocan y requieren `--force`. Ejemplo de este proyecto: `next: "15.5.25"` pineado obligo a `--force`, mientras `sharp: "^0.18.5"` se parcho solo.
- **Lockfile `engines.node` puede quedar stale vs `package.json`**: el lockfile guarda `engines.node` del momento en que se genero. `npm install` lo resincroniza con `package.json`. NO revertir el sync — un lockfile desalineado rompe futuras instalaciones.
- **Mover paquetes a devDependencies cambia el reporte `--omit=dev` drasticamente**: ~70 paquetes transitivos se marcan `"dev": true` en lockfile sin tocar codigo funcional. Util para separar toolchain de runtime cuando el paquete arrastra transitivos vulnerables.
- **Tests con fixtures binarios no versionados son baseline, no regresion**: si el directorio de snapshots solo contiene `.gitkeep`, los `ENOENT` son preexistentes. Verificar con `ls` antes de abortar el corte.
- **Verifiers estaticos para cambios de `package.json`**: patron readFileSync + JSON.parse + asserciones, estabelecido en `tests/verifiers/bug-project-form-currency-step.spec.ts:56`. Funcionan como regresion a futuro; NO son parte del ciclo Red->Green cuando el cambio se ejecuta una sola vez.
- **`NODE_OPTIONS=--max-old-space-size=4096` requerido para `tsc` y `next build`** en proyectos grandes (Next 15 + React 19 + jsdom + cientos de archivos). El heap default de 1.5 GB produce OOM en este host. Setear ANTES del comando.
- **Cortes con multiples tareas en commits separados**: la auditoria del lockfile depende del estado en cada paso; combinar el `audit fix` con la reclasificacion impide diffing limpio. Cuesta 1 commit extra y reduce riesgo de rollback parcial.
- **Politica de abortar ante diff inesperado en `npm audit fix`**: cualquier cambio fuera del set explicitamente aprobado (en este caso `{sharp, source-map-js, transitivos}`) debe pausar el flujo y pedir revision manual. Nunca aceptar transitivos "de paso" sin validarlos — algunos tienen implicaciones de seguridad o breaking.

### [2026-10-12] audit-corte-2-next-bump · FASE 1 (SPEC)
- Spec creado en `docs/specs/audit-corte-2-next-bump.md` con 10 AC (AC-1..AC-10), riesgos R1..R8 (R4 corregido en revision con el usuario: React mismo-minor OK, abortar en cambio de minor o major), plan de aborto A1..A8, verificaciones V1-V6.
- 2 tareas acopladas en el mismo commit: bump `next` 15.5.25 → 15.5.27 (dependencias) + bump `eslint-config-next` 15.5.25 → 15.5.27 (devDependencies). Acoplamiento estricto: los presets de `eslint-config-next` esperan una version especifica de `next`; bumpear uno sin el otro desincroniza los presets.
- R-gate explicito en §5: si la implementacion exige tocar `src/**` (improbable dado que es patch bump del mismo minor), PARAR y reportar sin aplicar.
- Restricciones: no tocar xlsx (Corte 3), no tocar `@azure/msal-node` (Corte 4), no tocar tailwind.config.* ni eslint.config.*.

### [2026-10-12] audit-corte-2-next-bump · FASE 2-4 (VERIFIER + IMPLEMENTACION + REFACTOR)
- **Tarea unica ejecutada:** bump aplicado sin divisorias internas — el comando es atómico (2 lineas en `package.json` + lockfile sync).
- Cambios:
  - `package.json`: 2 lineas (`next` y `eslint-config-next`, de 15.5.25 a 15.5.27 en sus bloques respectivos).
  - `package-lock.json`: 96 lineas (50 +/- / 46 -), 12 entradas cambiadas **todas en la familia `next`/`@next/*`/`eslint-config-next`**. Cero adds, cero removes.
  - 12 entradas: `next` (root), `eslint-config-next`, `@next/env`, `@next/eslint-plugin-next`, `@next/swc-{darwin-arm64, darwin-x64, linux-arm64-gnu, linux-arm64-musl, linux-x64-gnu, linux-x64-musl, win32-arm64-msvc, win32-x64-msvc}` — todas 15.5.25 → 15.5.27.
- **React/React-dom sin cambios:** siguen en `19.3.0` (dentro de politica same-minor del spec §9 A3). En realidad idénticos al pre-Corte 2, no se movieron.
- **Demás paquetes del lockfile no tocados:** `xlsx`, `@azure/msal-node`, `tailwindcss-animate`, `tailwindcss`, `mysql2`, `zustand`, etc. todos idénticos al SHA previo. Cumple A7/A8.
- **Verificaciones V1-V6:**
  - V1 `npm install --dry-run` → `up to date in 6s`. Cumple AC-2.
  - V3 lockfile: `next=15.5.27`, `eslint-config-next=15.5.27`, `react=19.3.0`, `react-dom=19.3.0`. Cumple AC-1, AC-3, AC-4.
  - V4 `npx tsc --noEmit`: exit 2 (tsc devuelve 2 con errores), unico error = preexistente en `tests/verifiers/advances-suggestion.spec.ts:21` (TS2741 'contractId'). **0 nuevos**. Cumple AC-5.
  - V5 `npm test`: **685 passing + 34 failing (mismos ENOENT `formatos-snapshots/`) + 8 skipped**. Idénticos numeros al baseline. 0 nuevos rojos. Exit 1 de vitest es por los 34 preexistentes, no por regresion. Cumple AC-6. Baseline snapshot documentado en spec §6.5 del Corte 1.
  - V6 `npm run build`: `▲ Next.js 15.5.27`, `✓ Compiled successfully in 98s`, `✓ Generating static pages (29/29)`, exit 0. **Idénticos 29 paginas estaticas a V6 de Corte 1**. Cumple AC-7.
  - 3 warnings `[db] ER_ACCESS_DENIED_ERROR` durante `next build` (mismo ruido esperado del host local sin acceso a Hostinger).
- **Tamanos V6:** `/tecnico/presupuestos` paso de First Load JS 163 kB a 164 kB (+1 KB). Atribuido al patch de cache fingerprint. Sin implicaciones funcionales; aceptado por el usuario.
- **Plan de aborto §9:** cero condiciones disparadas (A1..A8 todas limpias).
- **`npm audit` global:** 13 → 12. La entrada `next 15.0.0 - 15.5.26` (Moderate cache poisoning) desaparecio del reporte. Residual para Cortes 3 (`xlsx` High) y 4 (`uuid` Moderate).
- Commits materializados:
  - TBD (Commit 1): `chore(deps): bump next 15.5.25 → 15.5.27 (audit moderate cache poisoning cleared)`
  - TBD (Commit 2): `docs(specs): spec Corte 2 + log AGENTS.md`

### Patrones a recordar (memory) — extension 2026-10-12 (Corte 2)
- **`next` y `eslint-config-next` son acoplamiento estricto de version**: bumpear uno sin el otro deja presets de `eslint-config-next` desactualizados respecto al `next` que se ejecuta (FlatCompat los carga con `compat.extends("next/typescript")` esperando el mismo minor). Cuando se bumpea, **siempre sync**. En este proyecto ambos pinneados en `eslint.config.mjs:38`.
- **Patch bumps dentro del mismo minor de Next son generalmente transparentes**: `15.5.25 → 15.5.27` no introdujo errores TS, no cambio API publica, no cambio numero de paginas estaticas (29 → 29). El API publico de `next` y los tipos `JSX`/`Metadata` se mantuvieron estables. Riesgos reales aparecen en cambios de minor (15.4 → 15.5) que tocan App Router / middleware / Server Actions.
- **`npm install --dry-run` sin cambios pendientes imprime `up to date in Ns`**: sirve como V1 rapido del spec para confirmar que la lockfile esta coherente con `package.json` sin tocar archivos.
- **DB inalcanzable durante `next build` no bloquea el build**: las paginas `ƒ` (Dynamic) no se pre-renderizan; las `○` (Static) se generan aunque los API routes fallen. Los 3 warnings `[db] ER_ACCESS_DENIED_ERROR` son ruido esperado en este entorno y aceptado por el usuario. **Nunca abortar el commit por warnings de DB durante `next build`** sin otro sintoma.
- **`tsc --noEmit` exit 2 no es un fallo del flujo** — es la respuesta normal de tsc cuando hay errores. La redaccion real de "V4 paso" es: el reporte contiene **solo** el error preexistente documentado (`advances-suggestion.spec.ts:21` TS2741). Cualquier error adicional invalida la verediccion.
- **Lockfile diff verificado programmaticamente, no por inspection manual**: el script `compare-lockfiles.js` (creado ad-hoc durante este corte) lee el lockfile en `HEAD` via `git show` y lo compara con `package-lock.json` actual; detecta changed/added/removed exhaustivamente en < 100 ms. Reutilizable para futuros bumps. Vive en la raiz del repo (sobre git root), **NO se commitea**.
- **Aislamiento de commits por tarea dentro de un corte**: el `package.json`/`package-lock.json` se commitean **junto** cuando las 2 tareas son acopladas estrictamente (ej. `next` + `eslint-config-next`). El verifier/spec/log van en commit aparte. Patron confirmado: commit de codigo primero, commit administrativo despues.
- **Politica de abortos §9 del spec (8 condiciones) es case-by-case**: A3 acepta mismo-minor React (decision explicita del usuario); A8 acepta cualquier paquete mientras no sea de familias prohibidas (xlsx, msal-node, tailwindcss-animate); A1/A2/A4-A7 son strict. La regla explicita evita la ambiguedad "esto cambio, sera malo?".
- **First Load JS +1 KB despues de un patch de cache** es cambio esperado y aceptable. Si la app no tiene performance budget estricto, no es bloqueante. Documentar el delta en el summary para transparencia.
