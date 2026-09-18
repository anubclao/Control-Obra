# Project Constraints & Rules

> Reglas que el agente debe respetar. Distinguen lo que **está garantizado** hoy
> de lo que es **objetivo** (deuda aceptada, no la rompas más).
>
> Última verificación contra el código: 2026-09-18.

## TypeScript

- ⚠️ `strict: false` y `noImplicitAny: false` en `tsconfig.json`. Es deuda
  conocida y no se cambia sin un plan aparte: activarlo hoy rompe miles de
  líneas.
- **Consecuencia práctica:** sin `strictNullChecks`, TypeScript **no** estrecha
  uniones discriminadas. Un tipo resultado debe declarar todos los campos en
  ambos miembros para que `if (!r.ok) r.error` compile:

  ```ts
  export type Result =
    | { ok: true;  target: X; code?: undefined; error?: undefined }
    | { ok: false; target?: undefined; code: Code; error: string };
  ```

  Ver `src/lib/cuts-workflow.ts` como referencia.
- ✅ `npx tsc --noEmit` debe quedar en **0 errores**, tests incluidos. Es la
  línea base actual; no se admite bajarla.
- 🎯 Objetivo: no introducir `any` nuevo. Hay ~226 en el código heredado; el
  código nuevo se escribe tipado.
- ✅ Interfaces para props de componentes y para los contratos de `lib/`.

## Componentes

- ✅ Solo componentes funcionales.
- ✅ Props destructuradas en la firma.
- 🎯 Objetivo <300 líneas por componente. Hay 14 archivos entre 450 y 923
  líneas; al tocar uno de ellos, extraer en vez de seguir creciéndolo.

## Lógica de negocio

- ✅ **Toda regla de negocio va en una función pura de `src/lib/`**, con el
  sufijo del módulo (`-workflow.ts`, `-validation.ts`, `-constants.ts`). Sin BD,
  sin React, sin `fetch` dentro.
- ✅ **La ruta `/api/*` importa esa función; no duplica la regla.** Si una
  transición de estado aparece escrita en dos lugares, es un bug.
- ✅ Los resultados usan `{ ok: true, ... }` / `{ ok: false, code, error, status }`
  con `code` de una unión literal. Nunca se asertan mensajes de texto.
- ❌ Nunca confiar en validación solo de UI. Botón deshabilitado ≠ regla
  aplicada.

## Estado

- ✅ Zustand para estado global (`src/lib/data-store.ts` y los hooks por módulo).
- ❌ No Redux.
- ❌ No agregar módulos nuevos al god-module `data-store.ts` sin necesidad; si el
  módulo es nuevo, crear su propio store.
- ❌ No persistir datos de dominio en localStorage: la fuente de verdad es MySQL.

## API

- ✅ Desde el cliente, todo pasa por `lib/api.ts` (`api.get/post/put/patch/del`).
- ✅ `async/await`, sin cadenas de `.then()` en código nuevo.
- ✅ Toda ruta empieza con `requireAuth()` / `requireRole(...)` / `requireAdmin()`
  y corta con `authFailureResponse(...)`.
- ✅ Errores explícitos con status correcto: 400 validación, 403 rol, 404 no
  existe, 409 conflicto/duplicado, 500 inesperado.
- ✅ Respuestas tipadas.

## Base de datos

- ✅ `database/mysql/init.sql` es el contrato del esquema; los cambios van como
  migración numerada en `database/mysql/migrations/`.
- ⚠️ Un `UNIQUE KEY` de MySQL compara la cadena literal. Si la unicidad del
  negocio es sobre un valor normalizado (NIT sin puntos ni guiones), hay que
  validarla en la ruta además del índice.

## Testing

- ✅ TDD: el verifier se escribe **antes** de la implementación y debe fallar
  primero (Red phase).
- ✅ Los verifiers viven en `nextjs_space/tests/verifiers/[feature].spec.ts`, uno
  por spec. La plantilla es `TEMPLATE_test.spec.ts.template` (la extensión la
  deja fuera de la corrida).
- ✅ Se prueban las **funciones puras de `lib/`**, no los stores ni la BD. Como
  las rutas importan esas funciones, así se cubre el servidor.
- ✅ Un `it` por criterio de aceptación, con el número de AC en el nombre.
- ✅ `npm test` debe quedar **en verde completo**. Un verifier en rojo permanente
  hace que nadie vuelva a mirar el semáforo.
- ❌ Nunca `require()` dentro de un test: el módulo es ESM y el `require` lanza,
  con lo que un `try/catch` alrededor convierte la implementación real en un
  falso rojo.
- ❌ No modificar un test para que pase: se arregla el código, o se corrige el
  contrato en la spec y se documenta por qué.
- ✅ Al refactorizar `lib/`, actualizar los verifiers que importan lo movido en
  el mismo commit. Un import roto hace que el archivo entero ejecute 0 tests
  sin que el conteo lo delate.
