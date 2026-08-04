# Base de Datos — Control de Obra Pro

## Estado actual: **Fase 1 (sin BD en producción)**

La aplicación **aún no se conecta** a MySQL. Los datos viven en `localStorage` con Zustand persist (Fase 1: mocks).

Este directorio contiene el **schema inicial** listo para cuando se integre la BD (Fase 2).

## Archivos

| Archivo     | Propósito                                                                          |
| ----------- | ---------------------------------------------------------------------------------- |
| `init.sql`  | Schema completo de la base de datos. **NO contiene datos de ejemplo** (seed-free). |
| `README.md` | Este archivo.                                                                      |

## Inicialización

```bash
# Opción 1: desde MySQL CLI
mysql -u root -p < init.sql

# Opción 2: desde Docker
docker run -it --rm mysql:8.0 \
  mysql -h host.docker.internal -u root -p < init.sql

# Opción 3: desde MySQL Workbench / DBeaver
#   Abrir init.sql → Ejecutar todo
```

## Verificación post-inicialización

```sql
-- 1. Confirmar que la BD existe
SHOW DATABASES LIKE 'control_obra';

-- 2. Confirmar que las tablas se crearon (~25 tablas esperadas)
USE control_obra;
SELECT COUNT(*) AS total_tablas
FROM information_schema.tables
WHERE table_schema = 'control_obra';

-- 3. Ver todas las tablas
SHOW TABLES;

-- 4. Confirmar que no hay datos de ejemplo
SELECT 'users' AS tabla, COUNT(*) AS registros FROM users
UNION ALL
SELECT 'projects', COUNT(*) FROM projects
UNION ALL
SELECT 'providers', COUNT(*) FROM providers;
-- Esperado: 0 registros en cada tabla
```

## Convenciones del Schema

### IDs

- **VARCHAR(36)** — UUID v4 generado en la app (no AUTO_INCREMENT)
- Esto permite IDs estables entre cliente y servidor, y facilita sincronización offline-first

### Timestamps

- `created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
- Siempre en UTC. Conversión a zona local en la UI

### Soft deletes

- Las tablas principales tienen `is_active TINYINT(1) NOT NULL DEFAULT 1` o `deleted_at DATETIME NULL`
- **Nunca** se hace `DELETE FROM` directo — se marca como inactivo/eliminado

### Auditoría

- Tabla `audit_events` con índices por `(entity_type, entity_id)`, `project_id`, `actor_id`, `occurred_at`
- Trigger recomendado en cada tabla crítica (ver triggers.sql cuando exista)

### Charset

- `utf8mb4` con collation `utf8mb4_unicode_ci`
- Soporta emojis y caracteres especiales

### Motor

- `InnoDB` en todas las tablas (FK, transacciones, integridad referencial)

## Tablas principales (resumen)

| Tabla                     | Propósito                              |
| ------------------------- | -------------------------------------- |
| `users`                   | Usuarios del sistema                   |
| `invitations`             | Códigos únicos de invitación           |
| `projects`                | Proyectos de construcción              |
| `budgets`                 | Presupuesto Tope (PT) por proyecto     |
| `budget_versions`         | Histórico de versiones del PT          |
| `budget_layers`           | Capítulos/subcapítulos                 |
| `budget_items`            | Ítems del presupuesto                  |
| `budget_unforeseen_items` | Ítems no previstos                     |
| `aiu_configs`             | Configuración A/I/U por proyecto       |
| `contracts`               | Contratos con contratistas             |
| `contract_documents`      | Pólizas, contrato firmado, etc.        |
| `work_cuts`               | Cortes de obra                         |
| `work_cut_items`          | Ítems ejecutados en el corte           |
| `work_cut_documents`      | Soportes del corte                     |
| `work_cut_approvals`      | Historial de aprobaciones              |
| `pscs`                    | Presupuestos Proveedor (espejo del PT) |
| `psc_items`               | Ítems del PSC                          |
| `providers`               | Proveedores/contratistas unificados    |
| `provider_documents`      | Docs del proveedor (RUT, cámara, etc.) |
| `provider_references`     | Referencias comerciales                |
| `work_logs`               | Bitácora diaria de obra                |
| `work_log_photos`         | Fotos de la bitácora                   |
| `expenses`                | Registro de gastos (PDF p.7-14)        |
| `expense_items`           | Ítems de gastos con soportes           |
| `payment_requests`        | Solicitudes de pago                    |
| `payment_approvals`       | Historial de aprobaciones              |
| `tax_configs`             | Configuración de impuestos             |
| `employees`               | Empleados (RRHH)                       |
| `employee_documents`      | 11 tipos de documentos                 |
| `clients`                 | Clientes (CRM)                         |
| `quotations`              | Cotizaciones a clientes                |
| `quotation_items`         | Ítems de cotización                    |
| `audit_events`            | Log de auditoría global                |

## Migración desde Fase 1 (mocks → BD)

Cuando se integre la BD:

1. **Contrato del schema**: `database/mysql/init.sql` es la fuente de verdad
2. **Cliente BD**: agregar `mysql2` o `prisma` a `package.json` (recomendado Prisma 6.x según PRD)
3. **API Routes**: crear `src/app/api/*` con los endpoints REST o usar tRPC
4. **Migrar stores**: cada `useXxxStore` pasa de Zustand-only a Zustand + React Query/SWR
5. **Tests**: los verifiers actuales sirven como contract tests; agregar integration tests contra BD

## Datos de ejemplo (NO incluidos intencionalmente)

Este schema **NO** carga datos seed. Razones:

1. **Privacidad**: aunque los mocks son ficticios, no deben quedar en producción
2. **Reproducibilidad**: cada deploy empieza limpio
3. **Tests**: los mocks viven en `src/mocks/` y se usan solo en dev/test
4. **Roles**: en producción, el primer usuario debe crearse con rol `ADMIN` por un script seguro de bootstrap

Si necesitas datos para desarrollo local, créalos en `database/mysql/seed.local.sql` (gitignored) o usa los mocks de `src/mocks/`.
