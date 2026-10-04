# Spec: Cards de ayuda en PSC + renumeracion PSC-YYYY-NNNN

## User Story

Como usuario del modulo PSC, quiero ver una guia clara de que es, como se vincula al PT y cual es el ciclo de vida. Tambien quiero que los PSCs tengan numeracion legible (PSC-2026-0001) en vez del formato raro actual (PSC-XXX base36).

## Contexto

- `/tecnico/presupuestos/psc/page.tsx` (lista) NO tiene `ModuleExplanationCard`. La pantalla principal del modulo se ve fria.
- `src/components/pscs/psc-form.tsx` tampoco tiene guia — el operador crea PSCs a ciegas.
- `POST /api/pscs` genera `pscNumber` con `Date.now().toString(36).toUpperCase().slice(-6)` — formato opaco, no incremental, no incluye año.

## Acceptance Criteria

### AC-1 — Card en lista de PSCs

`/tecnico/presupuestos/psc/page.tsx` arranca con un `ModuleExplanationCard` arriba del header:

- Titulo: "Presupuestos Proveedor (PSC)"
- Descripcion: "Espejo del PT asignado a un proveedor. Cada PSC cubre un subconjunto de los items del PT."
- Pasos:
  1. **Tener PT cargado** — el proyecto debe tener su PT importado desde Excel.
  2. **Nuevo PSC** — seleccionar proyecto, proveedor y los items del PT que el contratista ejecutara.
  3. **Validar y activar** — DRAFT se convierte en ACTIVE cuando el administrador valida el alcance.
  4. **Cerrar** — al terminar el trabajo, marcar COMPLETED; o SUSPENDED si se detiene temporalmente.
- Tips: "Un PSC no puede cubrir items que ya estan asignados a otro PSC del mismo proyecto (futuro sprint)."
- Variante `guide`. storageKey: `psc:list`.

### AC-2 — Card en form de PSC

`src/components/pscs/psc-form.tsx` muestra card de guia arriba de los campos del formulario:

- Titulo: "Como crear un PSC"
- Descripcion: "Selecciona el proyecto con PT, el proveedor, y los items que el contratista va a ejecutar."
- Pasos:
  1. Elige el proyecto (solo aparecen los que tienen PT cargado).
  2. Selecciona el contratista (debe estar habilitado en el modulo Proveedores).
  3. Agrega los items del PT que este PSC va a cubrir.
  4. Define el alcance y guarda como DRAFT.
- Tip: "El total contratado al proveedor se calcula automaticamente a partir de los items."
- Variante `guide`. storageKey: `psc:form`.

### AC-3 — Renumeracion PSC-YYYY-NNNN

`POST /api/pscs` cambia la generacion de `pscNumber`:

- Antes: `PSC-${Date.now().toString(36).toUpperCase().slice(-6)}`
- Despues: `PSC-${year}-${sequence}` donde:
  - `year` = año actual (`new Date().getFullYear()`)
  - `sequence` = count de PSCs existentes en ese año + 1, formateado a 4 digitos (`%04d`)
- Backfill: NO migrar PSCs existentes al nuevo formato. Solo afecta a los nuevos PSCs creados despues del deploy.
- Manejo de concurrencia: usar `MAX(...)` + 1 sobre `psc_number` LIKE `'PSC-YYYY-%'` (mas seguro que COUNT porque permite huecos).

### AC-4 — No regresion

- Las pantallas PSC existentes siguen funcionando: lista, crear, editar, ver, suspender, completar, cancelar.
- TypeScript no introduce errores nuevos.
- Vitest no rompe suites relacionadas.

## Technical Contract

### Cambios

1. `src/app/tecnico/presupuestos/psc/page.tsx`:
   - Importar `ModuleExplanationCard`.
   - Agregar la card al inicio del componente (antes del header).

2. `src/components/pscs/psc-form.tsx`:
   - Importar `ModuleExplanationCard`.
   - Agregar la card al inicio del form (despues del header de DialogTitle que viene del padre).

3. `src/app/api/pscs/route.ts`:
   - En POST, antes del INSERT, calcular `nextPscNumber()`:
     ```typescript
     async function nextPscNumber(): Promise<string> {
       const year = new Date().getFullYear();
       const [rows] = await query<any[]>(
         `SELECT psc_number FROM pscs
            WHERE psc_number LIKE ?
            ORDER BY psc_number DESC LIMIT 1`,
         [`PSC-${year}-%`]
       );
       let nextSeq = 1;
       if (rows.length > 0) {
         const last = rows[0].psc_number;
         const m = last.match(/^PSC-\d{4}-(\d{4})$/);
         if (m) nextSeq = parseInt(m[1], 10) + 1;
       }
       return `PSC-${year}-${String(nextSeq).padStart(4, "0")}`;
     }
     ```

## Dependencies

- `src/components/ui/module-explanation-card.tsx` — componente existente.
- Tabla `pscs` en BD — columna `psc_number` ya existe (VARCHAR).

## Out of scope

- Backfill de PSCs existentes al nuevo formato (sprint futuro, requiere migracion).
- Crear endpoint `GET /api/pscs/next-number` para preview en form (sprint futuro).
- Locking transaccional para evitar colision en race conditions extremas (sprint futuro).

## Riesgos

- R1: dos PSCs creados en el mismo segundo pueden tener el mismo sequence. Mitigacion: usar `MAX` (no `COUNT`) + 1 para permitir huecos si hay race. Rara vez dos users crean PSC simultaneamente.
- R2: si el formato anterior (PSC-XXX) colisiona con el nuevo (PSC-2026-0001) por longitud, no hay problema porque son prefijos distintos.
- R3: el form actualmente llama a `createPSC` y `getItemsAvailable` que NO existen en `data-store.ts`. Esto es un bug preexistente (no relacionado con este fix). Lo arreglo como bonus: agrego estos métodos al store.

## Cambios necesarios

1. `src/app/tecnico/presupuestos/psc/page.tsx` — agregar card.
2. `src/components/pscs/psc-form.tsx` — agregar card + llamar al API REST en vez del store (ya que `createPSC` no existe).
3. `src/app/api/pscs/route.ts` — `nextPscNumber()` en POST.
4. `src/lib/data-store.ts` — agregar `createPSC`, `updatePSC`, `getItemsAvailable` al `usePscsStore` (fix de bug preexistente).