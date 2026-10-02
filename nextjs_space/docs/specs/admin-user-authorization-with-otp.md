# Feature: Admin — Creación de Usuarios por Rol con Autorización OTP

## 1. User Story

**As a** Super Administrador (rol `ADMIN`) del sistema Control de Obra Pro,
**I want** crear, autorizar, suspender y eliminar usuarios desde el módulo `/administrativo/usuarios`, asignándoles un rol, un área y opcionalmente un proyecto, dejando el correo electrónico en estado `PENDING` hasta que yo lo active,
**So that** solo los correos electrónicos pre-autorizados puedan recibir códigos OTP y autenticarse en `/login`, eliminando el flujo manual de "copiar/pegar código de invitación" y garantizando control centralizado de quién accede al sistema.

**As a** usuario final (cualquier rol no-`ADMIN`),
**I want** escribir mi correo corporativo en `/login` y recibir un código OTP de 6 dígitos,
**So that** pueda entrar al sistema sin contraseñas, siempre que mi correo ya haya sido autorizado previamente por el Super Admin.

---

## 2. Acceptance Criteria

### AC-1 · Módulo `/administrativo/usuarios` solo accesible para Super Admin
- [ ] Si el `user.role` actual ≠ `"ADMIN"`, la página muestra un `Alert` de "Acceso restringido" y NO renderiza la tabla ni el botón "Nuevo usuario".
- [ ] El link de navegación lateral al módulo se oculta para usuarios que no sean `ADMIN`.

### AC-2 · Crear usuario autorizado
- [ ] El formulario "Nuevo usuario autorizado" pide, como obligatorios: `email`, `nombre completo`, `rol`, `área`.
- [ ] El `rol` se selecciona desde un `Select` con la lista: `ADMIN, GERENTE, DIRECTOR, RESIDENTE, CONTABILIDAD, TESORERIA, HSEQ, CLIENTE, USER`.
- [ ] El `área` se selecciona desde un `Select` con: `tecnico, administrativo, ventas`.
- [ ] El campo `proyecto` es opcional y muestra los proyectos disponibles desde `useProjectsStore`. Si se deja vacío, el usuario tiene acceso a todos.
- [ ] El email se valida con regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` antes de enviar.
- [ ] Si el email ya existe en el store, se rechaza con error "Este correo ya está registrado".
- [ ] Al crear, el estado inicial del usuario es `PENDING` y `createdBy = user.id` del Super Admin actual.

### AC-3 · Autorizar (activar) usuario
- [ ] Cada fila de la tabla de usuarios tiene un botón "Activar" si `status === "PENDING"`.
- [ ] Al activar: `status` pasa a `ACTIVE`, se registra `authorizedBy = currentUser.id` y `authorizedAt = now()`.
- [ ] El cambio se persiste en `useUsersStore` (mock) o en la BD cuando exista.

### AC-4 · Suspender / Reactivar
- [ ] Si `status === "ACTIVE"`, el botón muestra "Suspender" → cambia a `SUSPENDED`.
- [ ] Si `status === "SUSPENDED"`, el botón muestra "Reactivar" → vuelve a `ACTIVE`.
- [ ] Un usuario `SUSPENDED` NO puede solicitar OTP (la API devuelve 403 "Cuenta suspendida").

### AC-5 · Eliminar usuario
- [ ] El botón "Eliminar" abre un `confirm-dialog` pidiendo confirmación.
- [ ] Solo se permite eliminar si el usuario NO tiene historial crítico (cortes, pagos, contratos). Si lo tiene, el botón está deshabilitado con tooltip explicativo.
- [ ] Al confirmar, se elimina del store y la fila desaparece con animación.

### AC-6 · KPIs del módulo
- [ ] Tarjeta "Usuarios activos" cuenta `status === "ACTIVE"`.
- [ ] Tarjeta "Pendientes de autorizar" cuenta `status === "PENDING"`.
- [ ] Tarjeta "Suspendidos" cuenta `status === "SUSPENDED"`.
- [ ] Tarjeta "Total autorizados" cuenta todos los registros.

### AC-7 · Búsqueda y filtros
- [ ] Input de búsqueda filtra por `email`, `nombre` o `rol` (case-insensitive, contains).
- [ ] Filtro por `rol` (Select) y por `estado` (Select: Todos / Pendientes / Activos / Suspendidos).

### AC-8 · Integración con login OTP (sin cambios en el front de login)
- [ ] El endpoint `POST /api/auth/request-otp` debe consultar la whitelist de usuarios y:
  - Si el email NO existe → `404 "Este correo no está registrado. Contacta al administrador."` (comportamiento ya existente).
  - Si existe y `status !== "ACTIVE"` → `403 "Tu cuenta está pendiente de autorización o fue suspendida."`.
  - Si existe y `status === "ACTIVE"` → generar OTP, enviar email, devolver `200 { ok: true }`.
- [ ] El endpoint `POST /api/auth/verify-otp` debe resolver el usuario desde el whitelist (no de una tabla `Invitation`) y devolver `user = { id, email, name, role, area }`.

### AC-9 · Migración del flujo de invitaciones
- [ ] El store `useInvitationsStore` se conserva por compatibilidad, pero la UI del módulo `/administrativo/usuarios` deja de usarlo para crear nuevos ingresos.
- [ ] Las invitaciones existentes en mock se migran a la nueva tabla de usuarios autorizados: cada invitación `ACCEPTED` se convierte en un usuario `ACTIVE` con el rol/área de la invitación; cada invitación `PENDING` se convierte en un usuario `PENDING`.

### AC-10 · Auditoría mínima
- [ ] Todo `AuthorizedUser` registra: `createdBy`, `createdAt`, `authorizedBy?`, `authorizedAt?`, `lastLoginAt?`, `suspendedBy?`, `suspendedAt?`.

---

## 3. Edge Cases

### Error States
- Email duplicado → "Este correo ya está registrado" (toast + scroll al campo).
- Email con formato inválido → "Correo electrónico no válido" inline.
- Cambio de estado cuando el usuario tiene sesión abierta → siguiente request del usuario será rechazado (forzar re-login).
- Falla SMTP al enviar OTP → `500 "El servidor falló al enviar el código. Verifica configuración SMTP."` (comportamiento ya existente).

### Empty States
- 0 usuarios en el sistema → estado vacío con icono `UserCog`, copy "Aún no has autorizado ningún usuario" y CTA "Crear primer usuario autorizado".
- 0 resultados tras filtrar → "No hay usuarios que coincidan con los filtros".

### Loading States
- Spinner (`Loader2`) en el botón "Crear" durante el submit.
- Skeleton rows en la tabla mientras se carga el store.

### Permisos
- El módulo entero gated por `useIsSuperAdmin()`.
- Las acciones de "Activar / Suspender / Eliminar" también gated por el mismo hook.
- Cualquier otro rol al intentar entrar → redirect a `/{user.area}`.

---

## 4. Technical Contract

### 4.1 Tipos nuevos

```typescript
// /src/types/index.ts (adición)

export type AuthorizedUserStatus = "PENDING" | "ACTIVE" | "SUSPENDED";

export interface AuthorizedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  area: Area;
  projectId?: string;            // alcance opcional
  status: AuthorizedUserStatus;
  createdBy: string;             // userId del Super Admin que creó el registro
  createdAt: string;             // ISO
  authorizedBy?: string;         // userId del Super Admin que activó
  authorizedAt?: string;
  suspendedBy?: string;
  suspendedAt?: string;
  lastLoginAt?: string;
}
```

### 4.2 API Contract (futuro, hoy mockeado en el store)

```typescript
// Peticiones
interface CreateAuthorizedUserRequest {
  email: string;
  name: string;
  role: Role;
  area: Area;
  projectId?: string;
}

interface UpdateAuthorizedUserStatusRequest {
  userId: string;
  status: AuthorizedUserStatus;  // PENDING | ACTIVE | SUSPENDED
}

// Respuestas
interface CreateAuthorizedUserResponse {
  ok: true;
  user: AuthorizedUser;
}

interface ListAuthorizedUsersResponse {
  ok: true;
  users: AuthorizedUser[];
}

// Cambios en endpoints existentes de auth
interface OtpRequestBody { email: string; }
interface OtpRequestResponse {
  ok: boolean;
  message: string;
  devCode?: string;             // solo en dev
  // status code: 200 | 403 | 404 | 500
}
```

### 4.3 Componente Props

```typescript
// /src/components/admin/AuthorizedUserForm.tsx
interface AuthorizedUserFormProps {
  onCreated: (user: AuthorizedUser) => void;
  createdBy: string;
  projects: Array<{ id: string; code: string; name: string }>;
}

// /src/components/admin/AuthorizedUserRow.tsx
interface AuthorizedUserRowProps {
  user: AuthorizedUser;
  projectName?: string;
  currentUserId: string;
  onAuthorize: (userId: string) => void;
  onSuspend:   (userId: string) => void;
  onReactivate:(userId: string) => void;
  onDelete:    (userId: string) => void;
}

// /src/components/admin/AuthorizedUsersTable.tsx
interface AuthorizedUsersTableProps {
  users: AuthorizedUser[];
  currentUserId: string;
  onAuthorize:   (userId: string) => void;
  onSuspend:     (userId: string) => void;
  onReactivate:  (userId: string) => void;
  onDelete:      (userId: string) => void;
}
```

### 4.4 Store (Zustand)

```typescript
// /src/lib/users-store.ts
interface UsersState {
  users: AuthorizedUser[];
  createUser: (input: CreateAuthorizedUserRequest, createdBy: string) => AuthorizedUser;
  authorizeUser: (userId: string, authorizedBy: string) => void;
  suspendUser:   (userId: string, suspendedBy: string)  => void;
  reactivateUser:(userId: string, authorizedBy: string) => void;
  deleteUser:    (userId: string) => void;
  findByEmail:   (email: string) => AuthorizedUser | undefined;
}
```

---

## 5. Dependencies

### Archivos a crear
- `/src/lib/users-store.ts` — Zustand store nuevo
- `/src/components/admin/AuthorizedUserForm.tsx`
- `/src/components/admin/AuthorizedUserRow.tsx`
- `/src/components/admin/AuthorizedUsersTable.tsx`
- `/src/components/admin/AuthorizedUsersFilters.tsx`
- `/src/components/admin/AuthorizedUsersKpis.tsx`
- `/tests/verifiers/admin-user-authorization.spec.ts`

### Archivos a modificar
- `/src/types/index.ts` — añadir `AuthorizedUser` y `AuthorizedUserStatus`
- `/src/app/administrativo/usuarios/page.tsx` — reemplazar flujo de invitaciones por el nuevo flujo de usuarios autorizados
- `/src/lib/permissions.ts` — sin cambios (ya existe `useIsSuperAdmin`)
- `/src/lib/navigation.ts` — opcional: ocultar link de "Administración" a no-ADMINs (gating visual)
- `/src/app/api/auth/request-otp/route.ts` — validar contra whitelist antes de enviar OTP
- `/src/app/api/auth/verify-otp/route.ts` — resolver `user` desde whitelist
- `/src/lib/data-store.ts` — añadir migración de `invitations` legacy → `users`

### Archivos a deprecar (mantener por compatibilidad, dejar de usar en UI nueva)
- `/src/components/admin/InvitationForm.tsx` (si existe como componente separado; revisar)
- Creación de nuevas invitaciones desde el módulo `/administrativo/usuarios`

---

## 6. Out of Scope

- Envío real de emails (seguirá mockeado: `devCode` se muestra en UI; SMTP queda preparado en backend).
- MFA / TOTP adicional al OTP por email.
- Auto-registro público (cualquier signup debe pasar por el Super Admin).
- Sincronización con directorios externos (LDAP, Google Workspace, Azure AD).
- Permisos granulares por recurso más allá de `role + area + projectId?`.
- Bloqueo por intentos fallidos (rate limit) — el endpoint OTP ya debería traerlo del backend.

---

## 7. Approval

**Status:** ⏳ Pending Review — esperando aprobación del usuario para pasar a PHASE 3 (Verifiers / TDD).
