# Bug: `/api/users` no exige autenticación

> **Estado:** ✅ Implementada el 2026-09-30. Verifier:
> `nextjs_space/tests/verifiers/users-api-auth.spec.ts`.

## 1. User Story

**As a** Super Admin (rol ADMIN),
**I want to** que solo yo pueda listar, crear, autorizar, suspender o
eliminar usuarios,
**So that** nadie pueda auto-registrarse, auto-autorizarse como ADMIN y
entrar con OTP saltándose el flujo de `admin-user-authorization-with-otp.md`.

## 2. Causa raíz

`src/app/api/users/route.ts` no llamaba a `requireAuth`/`requireAdmin` en
ningún handler (GET, POST, PATCH, PUT, DELETE) y no hay `middleware.ts`.
Además, la auditoría (`created_by`, `authorized_by`, `suspended_by`) se
tomaba del body, así que el cliente podía falsificarla.

Ataque posible sin sesión: `POST /api/users` (crear usuario propio) →
`PATCH /api/users { status: "ACTIVE", role: "ADMIN" }` → login por OTP.

## 3. Acceptance Criteria

- [x] AC-1: Sin cookie de sesión válida, todos los métodos responden **401**
      y no ejecutan ninguna escritura en BD.
- [x] AC-2: Con sesión de un usuario ACTIVE que no es ADMIN, todos los
      métodos responden **403** y no ejecutan ninguna escritura en BD.
- [x] AC-3: Con sesión ADMIN, los métodos funcionan como antes (GET 200,
      POST 201).
- [x] AC-4: `created_by`, `authorized_by` y `suspended_by` se toman del
      usuario de la sesión, ignorando lo que venga en el body.

## 4. Dependencias

- Solo consume `/api/users` la pantalla `/administrativo/usuarios`
  (`users-store.ts`), que ya es exclusiva de ADMIN → no se rompe nada.
- `data-store.ts` declara una colección `users` sobre `/api/users` pero
  nadie la carga.

## 5. Out of Scope

- Impedir que un ADMIN se suspenda o degrade a sí mismo (riesgo de quedarse
  sin administradores). Candidato a spec aparte.
