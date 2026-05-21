# Checklist de Despliegue en Hostinger (Control Obra)

Fecha: 2026-05-21

## 0) Pre-requisitos

- Repositorio actualizado en GitHub: `main`
- Dominio apuntando al hosting
- Acceso a hPanel (Hostinger)
- Acceso a phpMyAdmin

## 1) Crear Base de Datos MySQL

1. En hPanel entra a **Bases de datos MySQL**.
2. Crea una base y un usuario dedicado.
3. Guarda estos datos:
- Host
- Puerto
- Nombre de base
- Usuario
- Password

## 2) Importar SQL completo en phpMyAdmin

1. Abre phpMyAdmin desde hPanel.
2. Selecciona la base de datos creada.
3. Ve a **Importar**.
4. Sube el archivo:
- `nextjs_space/sql/control_obra_full_phpmyadmin.sql`
5. Ejecuta importación.

Si aparecen errores de `CREATE FUNCTION`, `CREATE TRIGGER` o `CREATE PROCEDURE`:
- Es una restricción de permisos del hosting.
- Continúa con despliegue en modo compatible (`DB_VERIFY_STRICT=0`).

## 3) Configurar Variables de Entorno en Hostinger

En la app Node.js, sección **Environment Variables**, crea estas claves:

### Obligatorias

- `NODE_ENV=production`
- `NEXTAUTH_URL=https://TU_DOMINIO`
- `NEXTAUTH_SECRET=SECRETO_LARGO_ALEATORIO`
- `DATABASE_URL=mysql://USUARIO:PASSWORD@HOST:PUERTO/NOMBRE_DB`

### Recomendadas (pool)

- `DB_POOL_CONNECTION_LIMIT=20`
- `DB_POOL_QUEUE_LIMIT=0`
- `DB_VERIFY_STRICT=0`

### Opcionales (si usas colas/reportes)

- `REDIS_URL=redis://127.0.0.1:6379`
- `FINANCIAL_REPORT_CONCURRENCY=2`
- `FINANCIAL_REPORT_JOB_CONCURRENCY=3`
- `FINANCIAL_REPORT_JOB_HISTORY=200`
- `FINANCIAL_REPORT_TTL_MS=86400000`

### Opcionales (si usas S3)

- `AWS_BUCKET_NAME=tu-bucket`
- `AWS_FOLDER_PREFIX=control-obra`

### Opcionales (si usas SharePoint)

- `SHAREPOINT_CLIENT_ID=tu-client-id`
- `SHAREPOINT_ACCESS_TOKEN=tu-access-token`

Referencia local de plantilla:
- `nextjs_space/.env.production.example`

## 4) Desplegar Aplicación

1. Configura el proyecto Node.js en Hostinger apuntando a rama `main`.
2. Ejecuta instalación de dependencias (`npm install`).
3. Ejecuta build (`npm run build`).
4. Configura start command (`npm run start`).
5. Reinicia la app desde el panel.

## 5) Verificación Post-Deploy (Smoke Test)

1. Abre `https://TU_DOMINIO/login`.
2. Inicia sesión con un usuario válido.
3. Verifica dashboard carga sin error 500.
4. Ve a Administración > Roles:
- Crear rol
- Guardar permisos
5. Ve a Administración > Usuarios:
- Asignar rol a usuario
6. Cierra sesión e ingresa con ese usuario.
7. Confirma que solo ve menús permitidos.

## 6) Verificación de Base de Datos

Si tienes consola del servidor:

```bash
npm run db:verify
```

Resultado esperado:
- "Verificacion completa exitosa (strict=0)"

Para modo estricto (solo si hosting permite objetos avanzados):

```bash
npm run db:verify:strict
```

## 7) Criterio Go / No-Go

Go:
- Login funciona
- Dashboard carga
- Crear/editar roles funciona
- Asignación de rol funciona
- Menú por permisos funciona

No-Go:
- Error 500 en login/dashboard
- No guarda roles o permisos
- Middleware no bloquea rutas no permitidas

## 8) Rollback rápido

1. Revertir último deploy a versión estable en Hostinger.
2. Reimportar SQL de versión estable si hubo cambios incompatibles.
3. Restaurar variables previas.
4. Reiniciar app.
