# DB Release Runbook (ControlObra)

## Objetivo

Estandarizar despliegue y validacion de objetos de base de datos para RBAC y capa SQL avanzada.

## Responsables

- Dev: ejecuta deploy y pruebas funcionales
- QA: valida flujos RBAC en UI/API
- DBA: habilita permisos avanzados para funciones/triggers/procedures

## Flujo rapido

```powershell
npm run db:deploy
npm run db:verify
```

Si `db:verify` termina OK, el sistema queda operativo en modo compatible.

## Flujo estricto (produccion)

```powershell
npm run db:verify:strict
```

Si falla por privilegios:

1. Ejecutar despliegue con usuario DBA.
2. Confirmar que existen funciones/triggers faltantes.
3. Repetir verificacion estricta.

## Smoke test funcional obligatorio

1. Crear rol de acceso.
2. Asignar permisos de menu al rol.
3. Asignar rol a un usuario.
4. Iniciar sesion con ese usuario.
5. Confirmar menu filtrado y acceso bloqueado por middleware donde corresponda.

## Rollback basico

Si una release rompe RBAC:

1. Reasignar usuarios a rol sistema `sys_admin`.
2. Reaplicar SQL base:
   - `migrations/add_access_control_roles.sql`
   - `migrations/add_access_control_db_objects.sql`
3. Reiniciar app.

## Criterio Go/No-Go

Go:
- Deploy sin error fatal
- Verify compatible en verde
- Smoke RBAC aprobado

No-Go:
- Falla de asignacion de roles
- Falla de middleware en rutas protegidas
- Integridad inconsistente de tablas `AccessRole`, `MenuPermission`, `UserAccessRole`
