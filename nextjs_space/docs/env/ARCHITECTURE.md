# Environment & Architecture

> Este documento describe el repositorio **como está hoy**. La Fase 1 de
> `AGENTS.md` lo lee antes de escribir cualquier spec, así que cualquier cambio
> estructural debe reflejarse aquí en el mismo commit.
>
> Última verificación contra el código: 2026-09-18.

## Ubicación del proyecto

El código vive en `ControlObra/nextjs_space/`, **no** en la raíz del repositorio.
Todos los comandos (`npm test`, `npm run dev`, `npx tsc`) se ejecutan desde ahí.

```
ControlObra/
  AGENTS.md              # Metodología Karpathy (spec → verifier → código)
  docs/env/              # Este documento y CONSTRAINTS.md
  docs/specs/            # Una spec por feature o bug
  nextjs_space/          # La aplicación
    PRD.md
    database/mysql/      # init.sql (schema) + migrations/
    src/
    tests/verifiers/     # Los verifiers (TDD)
```

## Tech Stack (verificado en package.json)

- **Framework:** Next.js 15.5.25 (App Router)
- **React:** 19.3
- **Language:** TypeScript 5 — `strict: false` hoy (ver CONSTRAINTS.md)
- **Styling:** TailwindCSS 3.4 + tailwindcss-animate
- **UI primitives:** Radix UI + shadcn-style en `src/components/ui/`
- **State Management:** Zustand 5 (un store unificado, ver abajo)
- **Base de datos:** MySQL vía `mysql2` (pool en `src/lib/db.ts`)
- **Validación:** Zod 4 + react-hook-form 7
- **Email:** nodemailer (invitaciones y OTP)
- **Excel:** xlsx (carga de presupuestos)
- **Testing:** Vitest 5 + React Testing Library + jsdom
- **Package Manager:** npm (`package-lock.json`); Node >= 22.18
- **IA:** ninguna. No hay integración con LLM en el producto.

## Estructura de `src/`

```
src/
  app/              # App Router: páginas por área + 27 rutas en app/api/
    tecnico/        # proyectos, presupuestos, aiu, contratos, proveedores,
                    # cortes, gastos, bitácora
    administrativo/ # contabilidad, empleados, impuestos, pagos, reportes,
                    # tesorería, usuarios
    ventas/         # clientes, cotizaciones, pipeline
    api/            # backend: una carpeta por recurso, cada una con route.ts
  components/       # UI por módulo (accounting/, cuts/, payments/, …) + ui/
  lib/              # TODA la lógica no-UI (ver abajo). No existe src/services/
  types/index.ts    # Tipos compartidos del dominio
  mocks/            # Datos de ejemplo heredados; la fuente de verdad es MySQL
```

No existen `src/services/`, `src/hooks/` ni `src/utils/`: su contenido está en
`src/lib/`.

## Convención de `src/lib/` — un módulo por dominio

Esta es la convención central del proyecto. Por cada módulo del negocio:

| Sufijo | Contenido | Ejemplo |
|---|---|---|
| `<modulo>-constants.ts` | Labels, variantes de badge, mapas de estado | `cuts-constants.ts` |
| `<modulo>-workflow.ts` | Máquina de estados: transiciones, roles, validación de acciones | `cuts-workflow.ts`, `payments-workflow.ts` |
| `<modulo>-validation.ts` | Reglas de validación de datos | `providers-validation.ts` |
| `<modulo>.ts` | Cálculos del dominio | `accounting.ts` |
| `<modulo>-api.ts` | Cliente HTTP específico | `accounting-api.ts` |

**Estas son funciones puras**: sin BD, sin React, sin `fetch`. Las rutas
`/api/*` las importan en vez de duplicar la lógica, así que verificarlas cubre
también el comportamiento del servidor. Es lo que hace testeable el workflow sin
levantar MySQL.

Transversales: `db.ts` (pool MySQL), `api.ts` (cliente fetch), `api-auth.ts` /
`session.ts` / `permissions.ts` (autenticación y roles), `api-helpers.ts`,
`rate-limit.ts`, `email.ts`, `excel-parser.ts`, `navigation.ts`, `utils.ts`.

## Estado de cliente

`src/lib/data-store.ts` es un **store Zustand unificado** para los 16 recursos
CRUD. Expone además hooks de compatibilidad por módulo (`useProjectsStore`,
`useCutsStore`, `usePaymentsStore`, …) que mantienen los nombres antiguos
(`addProject`, `updateCut`, …) sobre el store nuevo. Cada colección tiene
`items / loaded / loading / error` y `load / add / update / remove`, que hablan
con `/api/*`. No hay persistencia en localStorage: la fuente de verdad es MySQL.

Stores aparte: `auth-store.ts`, `users-store.ts`, `accounting-store.ts`.

> Deuda conocida: `data-store.ts` concentra los 16 módulos en un solo archivo.
> Los stores por módulo (`cuts-store.ts`, etc.) que mencionan specs antiguas ya
> no existen.

## Patrones clave

1. **Rutas API delgadas:** `route.ts` hace auth → lee BD → delega la decisión a
   una función pura de `lib/` → escribe. Ejemplo:
   `src/app/api/cuts/route.ts` + `src/lib/cuts-workflow.ts`.
2. **Validación en el servidor, no solo en UI:** toda regla de negocio (roles,
   transiciones de estado, unicidad, borrados) se aplica en la ruta API. La UI
   deshabilitar botones es una comodidad, nunca la garantía.
3. **Auth por rol:** cada ruta empieza con `requireAuth()`, `requireRole(...)` o
   `requireAdmin()` de `lib/api-auth.ts`, y devuelve `authFailureResponse(...)`.
4. **Errores con código estable:** las funciones de dominio devuelven
   `{ ok: false, code, error, status }`. La UI y los tests asertan sobre `code`,
   no sobre el texto del mensaje.
5. **Client Components:** la mayoría de páginas llevan `'use client'` porque
   consumen los stores de Zustand.
6. **Schema como contrato:** `database/mysql/init.sql` es la fuente de verdad
   del esquema; los cambios van en `database/mysql/migrations/`.

## Comandos

```bash
cd ControlObra/nextjs_space
npm install
npm run dev            # servidor de desarrollo
npm test               # vitest run  → los verifiers
npm run test:watch
npm run test:coverage
npx tsc --noEmit       # typecheck (src + tests)
npm run lint
node scripts/setup-db.mjs   # crear/poblar el schema
```
