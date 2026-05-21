# Hostinger 10 Min - Solo Comandos

## 1) SQL completo en phpMyAdmin

Importa este archivo en tu base de datos desde phpMyAdmin:

- `nextjs_space/sql/control_obra_full_phpmyadmin.sql`

## 2) Variables de entorno (Hostinger)

Copia estas variables en hPanel > Node.js > Environment Variables:

```env
NODE_ENV=production
NEXTAUTH_URL=https://TU_DOMINIO
NEXTAUTH_SECRET=SECRETO_LARGO_ALEATORIO
DATABASE_URL=mysql://USUARIO:PASSWORD@HOST:PUERTO/NOMBRE_DB

DB_POOL_CONNECTION_LIMIT=20
DB_POOL_QUEUE_LIMIT=0
DB_VERIFY_STRICT=0

# Opcionales
REDIS_URL=redis://127.0.0.1:6379
FINANCIAL_REPORT_CONCURRENCY=2
FINANCIAL_REPORT_JOB_CONCURRENCY=3
FINANCIAL_REPORT_JOB_HISTORY=200
FINANCIAL_REPORT_TTL_MS=86400000
AWS_BUCKET_NAME=tu-bucket
AWS_FOLDER_PREFIX=control-obra
SHAREPOINT_CLIENT_ID=tu-client-id
SHAREPOINT_ACCESS_TOKEN=tu-access-token
```

## 3) Build y arranque

Comandos en Hostinger (terminal del proyecto):

```bash
npm install
npm run build
npm run start
```

## 4) Verificacion rapida

```bash
npm run db:verify
```

Resultado esperado:

- `Verificacion completa exitosa (strict=0)`

## 5) Prueba funcional minima

1. Entrar a `/login`
2. Iniciar sesion
3. Abrir Administracion > Roles y crear rol
4. Asignar rol en Administracion > Usuarios
5. Reingresar con ese usuario y validar menu filtrado

## 6) Si falla por permisos MySQL

Si ves errores de `FUNCTION/TRIGGER/PROCEDURE`:

1. Mantener `DB_VERIFY_STRICT=0`
2. Solicitar a soporte/DBA permisos avanzados
3. Reintentar modo estricto luego:

```bash
npm run db:verify:strict
```
