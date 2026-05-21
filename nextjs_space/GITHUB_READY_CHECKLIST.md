# GitHub Ready Checklist - DB + RBAC

Fecha: 2026-05-21

## 1) Estado actual (resultado real)

- DB deploy compatible: OK (`npm run db:deploy`)
- DB verify compatible: OK (`npm run db:verify`)
- DB verify estricto: FAIL en entorno actual (`npm run db:verify:strict`)
- Motivo de fail estricto: privilegios MySQL insuficientes para crear funciones/triggers en servidor con binary log.

## 2) Cambios implementados

- Pool de conexiones y resiliencia:
  - `lib/db.ts`
  - `lib/mysql-pool.ts`
- Objetos SQL RBAC:
  - `migrations/add_access_control_db_objects.sql`
- Integracion API con procedimiento almacenado + fallback:
  - `app/api/access-control/users/[userId]/role/route.ts`
  - `app/api/access-control/roles/route.ts`
- Automatizacion de despliegue/verificacion:
  - `scripts/db-deploy.js`
  - `scripts/db-verify.js`
- Scripts npm:
  - `db:deploy`
  - `db:verify`
  - `db:verify:strict`
  - `db:check`
- Endurecimiento de script legacy:
  - `run-migration.js` (sin credenciales hardcodeadas)

## 3) Criterios de aprobacion para subir a GitHub

### Minimo (entorno con permisos limitados)

1. `npm run db:deploy` finaliza sin error fatal.
2. `npm run db:verify` finaliza con exit code 0.
3. Login + asignacion de rol + carga de menus funciona en UI.
4. No hay secretos hardcodeados en scripts.

### Estricto (produccion/CI completa)

1. `npm run db:verify:strict` finaliza con exit code 0.
2. Todas las funciones, vistas, procedures y triggers existen.
3. Usuario MySQL de despliegue tiene privilegios necesarios o se ejecuta por DBA.

## 4) Comandos de verificacion recomendados

```powershell
# desde nextjs_space
npm run db:deploy
npm run db:verify
npm run db:verify:strict
```

Verificacion funcional RBAC:

1. Crear rol desde Administracion > Roles.
2. Marcar permisos de menu y guardar.
3. Asignar rol a usuario desde Administracion > Usuarios.
4. Cerrar sesion, iniciar sesion con ese usuario.
5. Confirmar que solo ve menus permitidos.

## 5) Bloqueos conocidos antes de release total

- El entorno actual de MySQL restringe creacion de funciones/triggers (error de privilegios con binary log).
- Existen errores TypeScript historicos en modulos no tocados por esta tarea; no bloquean `db:deploy`/`db:verify`, pero si bloquean un `tsc --noEmit` global.

## 6) Plan corto para cerrar release estricto

1. Ejecutar despliegue SQL con usuario DBA o habilitar policy de creacion de funciones/triggers.
2. Re-ejecutar `npm run db:deploy` y `npm run db:verify:strict`.
3. Corregir lote de errores TypeScript legacy para habilitar gate global de CI.
4. Publicar con tag de release una vez todo quede en verde.

## 7) Evidencia operativa esperada

- `db:deploy` => "Despliegue SQL completado"
- `db:verify` => "Verificacion completa exitosa (strict=0)"
- `db:verify:strict` => "Verificacion completa exitosa (strict=1)"
