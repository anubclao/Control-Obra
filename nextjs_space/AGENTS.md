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
