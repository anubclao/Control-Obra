# Plantillas de CLAUDE.md por tipo de proyecto

## Reglas generales para CLAUDE.md efectivo

- **Conciso**: Menos de 200 líneas idealmente. Más largo = más tokens por sesión.
- **Actualizable**: Debe reflejar el estado ACTUAL del proyecto, no el inicial.
- **Accionable**: Solo información que Claude necesita para trabajar, no documentación.
- **Estructurado**: Headers claros para que Claude encuentre info rápido.

---

## Plantilla: Proyecto TypeScript / Node.js

```markdown
# Proyecto: [Nombre]

## Stack
- Runtime: Node.js 20 + TypeScript 5
- Framework: Express / Fastify / NestJS
- DB: PostgreSQL con Prisma
- Tests: Vitest

## Comandos
- Dev: `pnpm dev`
- Build: `pnpm build`
- Test: `pnpm test`
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`

## Convenciones de código
- 2-space indent
- Endpoints en snake_case
- Interfaces con prefijo I (IUser, IProduct)
- Archivos en kebab-case

## Estructura de carpetas
src/
  routes/      → Endpoints HTTP
  services/    → Lógica de negocio (AQUÍ va todo el acceso a DB)
  models/      → Tipos e interfaces
  middleware/  → Auth, validación, errores

## Decisiones arquitectónicas
- Sin ORM en routes, solo en services
- JWT stateless, sin sesiones en servidor
- Errores siempre como AppError(code, message)

## Estado actual
- Auth module: ✅
- Users CRUD: ✅
- Products: 🚧 en progreso (falta endpoint DELETE)
- Pagos: ⏳ pendiente

## Compactación
Al compact, preservar siempre: archivos modificados, decisiones de arquitectura,
estado de módulos en progreso.
```

---

## Plantilla: Proyecto React / Frontend

```markdown
# Proyecto: [Nombre] Frontend

## Stack
- React 18 + TypeScript
- Vite como bundler
- TailwindCSS
- React Query para fetching
- Zustand para estado global

## Comandos
- Dev: `npm run dev`
- Build: `npm run build`
- Test: `npm run test`
- Storybook: `npm run storybook`

## Convenciones
- Componentes en PascalCase
- Hooks en camelCase con prefijo use
- Props siempre tipadas con interface (no type)
- CSS: solo Tailwind, sin estilos inline

## Estructura
src/
  components/   → Componentes reutilizables (sin lógica de negocio)
  pages/        → Vistas principales
  hooks/        → Custom hooks
  store/        → Estado global Zustand
  api/          → Llamadas al backend (React Query)

## Patrones establecidos
- Formularios con react-hook-form + zod
- Modales con el componente Modal en /components/ui
- Notificaciones con toast de /lib/toast

## Estado actual
- Landing: ✅
- Auth flow: ✅
- Dashboard: 🚧 (falta sección de métricas)
- Perfil de usuario: ⏳ pendiente
```

---

## Plantilla: Proyecto Python / FastAPI

```markdown
# Proyecto: [Nombre] API

## Stack
- Python 3.11 + FastAPI
- SQLAlchemy + Alembic
- Pydantic v2
- pytest

## Comandos
- Dev: `uvicorn main:app --reload`
- Test: `pytest -v`
- Migrate: `alembic upgrade head`
- Lint: `ruff check .`

## Convenciones
- snake_case en todo
- Schemas Pydantic para I/O, modelos SQLAlchemy para DB
- Endpoints retornan siempre schema, nunca modelo ORM directamente

## Estructura
app/
  routers/    → Endpoints por dominio
  services/   → Lógica de negocio
  models/     → SQLAlchemy models
  schemas/    → Pydantic schemas
  deps.py     → Dependencias (DB session, auth)

## Estado actual
- [Actualizar con módulos completados / en progreso]
```

---

## Plantilla: Proyecto monorepo (Turborepo / Nx)

```markdown
# Monorepo: [Nombre]

## Estructura de packages
packages/
  ui/           → Componentes compartidos
  utils/        → Utilidades compartidas
  types/        → Tipos TypeScript compartidos
apps/
  web/          → Frontend React
  api/          → Backend Node.js
  admin/        → Panel de administración

## Comandos desde raíz
- Dev todo: `pnpm dev`
- Dev solo web: `pnpm dev --filter=web`
- Build: `pnpm build`
- Test: `pnpm test`

## Regla crítica
Al importar entre packages, SIEMPRE usar el nombre del package (@repo/ui),
nunca rutas relativas entre apps.

## Estado actual
- [Paquete]: [estado]
```

---

## Cómo actualizar CLAUDE.md antes de `/clear`

Pídele a Claude que haga el update por ti:

```
Antes de que hagamos /clear, actualiza el CLAUDE.md con:
1. Lista de archivos que modificamos hoy
2. Decisiones arquitectónicas que tomamos
3. Estado actualizado de cada módulo
4. Cualquier patrón nuevo que establecimos
```

Luego confirma el contenido y ejecuta `/clear`.
