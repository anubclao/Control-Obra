# Skill: Nuevo Módulo

Crea un módulo completo en el ERP ControlObra. El usuario debe indicar el nombre del módulo y el modelo Prisma asociado.

## Instrucciones

Se te dará el nombre de un nuevo módulo (ej: "inventario", "equipos", "garantias"). Tu trabajo es crear toda la estructura necesaria:

### 1. Modelo Prisma (`nextjs_space/prisma/schema.prisma`)
Agrega al final del schema el modelo con:
- `id` CUID como primary key
- `createdAt` y `updatedAt` con defaults
- Campos específicos del dominio
- Relaciones con `Project` si aplica
- Enums necesarios
- Índices relevantes

### 2. Capa de Servicio (`nextjs_space/modules/<nombre>/`)
Crea los siguientes archivos:

**`types.ts`** — Tipos TypeScript del módulo derivados del schema Prisma.

**`validations.ts`** — Schemas Zod para validación de entrada:
- Schema de creación (`CreateXxxSchema`)
- Schema de actualización (`UpdateXxxSchema`)  
- Schema de filtros/búsqueda (`FilterXxxSchema`)

**`queries.ts`** — Queries Prisma reutilizables:
- `findById(id)` — Con includes relevantes
- `findMany(filters)` — Con paginación y filtros
- `create(data)` — Con validación de unicidad
- `update(id, data)`
- `softDelete(id)` o `delete(id)`

**`service.ts`** — Lógica de negocio:
- Validaciones de negocio (no solo de formato)
- Auto-generación de códigos (ej: INV-2026-0001)
- Cálculos derivados
- Orquestación entre entidades

### 3. API Routes (`nextjs_space/app/api/<nombre>/`)

**`route.ts`** — Lista y creación:
```typescript
// GET /api/<nombre>?projectId=&page=&limit=
// POST /api/<nombre>
```

**`[id]/route.ts`** — Detalle, actualización, eliminación:
```typescript
// GET /api/<nombre>/[id]
// PUT /api/<nombre>/[id]
// DELETE /api/<nombre>/[id]
```

Cada endpoint debe:
- Validar sesión con `getServerSession(authOptions)`
- Verificar permisos por rol usando las constantes de `lib/constants.ts`
- Usar el service del módulo (no Prisma directo)
- Devolver errores estándar: `{ error: string }` con códigos HTTP correctos

### 4. Página UI (`nextjs_space/app/dashboard/<nombre>/`)

**`page.tsx`** — Server component:
- Obtiene datos usando el service
- Pasa datos al client component

**`_components/<Nombre>Client.tsx`** — Client component principal:
- Tabla con columnas relevantes usando el componente `<Table>` de Radix UI
- Barra de búsqueda y filtros
- Botón "Nuevo" que abre el Dialog de creación
- Paginación

**`_components/<Nombre>Form.tsx`** — Formulario con React Hook Form + Zod:
- Todos los campos del schema de creación
- Validación en tiempo real
- Submit con manejo de errores
- Toast de éxito/error con sonner

### 5. Navegación (`nextjs_space/components/dashboard-nav.tsx`)
Agrega el ítem de navegación en la sección correcta (Técnico, Administrativo o Ventas) con el ícono apropiado de lucide-react.

### 6. MySQL (`database/mysql/views.sql`)
Agrega una vista `v_<nombre>_summary` que consolide los datos principales del módulo para reportes.

## Convenciones obligatorias

- **Moneda**: Siempre COP, formatear con `formatCOP()` de `lib/format.ts`
- **Códigos auto**: `XXX-{YYYY}-{NNNN}` usando `String(count + 1).padStart(4, '0')`
- **Textos largos**: `@db.Text` en Prisma, `<Textarea>` en UI
- **Fechas**: `date-fns` para cálculos, `formatDate()` de `lib/format.ts` para display
- **IDs**: CUID vía `@default(cuid())` en Prisma
- **Errores HTTP**: 400 validación, 401 sin sesión, 403 sin permisos, 404 no encontrado, 500 servidor
- **Sin comentarios** en código excepto WHY no obvios

## Ejemplo de uso

```
/nuevo-modulo nombre="equipos" descripcion="Gestión de equipos y maquinaria de obra" area="tecnico"
```
