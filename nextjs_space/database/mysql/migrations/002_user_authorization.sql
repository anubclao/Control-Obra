-- =============================================================================
-- Migración 002 — Autorización de usuarios con estados PENDING/ACTIVE/SUSPENDED
-- =============================================================================
-- Spec: docs/specs/admin-user-authorization-with-otp.md
-- Crea:  2026-01-15
-- Aplica a: control_obra (MySQL 8.0+ / MariaDB 10.5+)
--
-- IMPORTANTE — Ejecutar manualmente desde tu cliente MySQL o panel Hostinger.
-- Esta migración es ADITIVA (no rompe nada existente).
--   - Mantiene is_active por compatibilidad con código legacy.
--   - El nuevo código de aplicación usará `status` en lugar de `is_active`.
--
-- Orden de ejecución sugerido:
--   1. Lee completo.
--   2. Ejecuta bloque por bloque, verificando que cada uno termine OK.
--   3. Si algo falla, los ALTER son transaccionales a nivel de tabla
--      (puedes re-ejecutarlos sin problema — IF NOT EXISTS los hace idempotentes).
-- =============================================================================

USE control_obra;

-- =============================================================================
-- BLOQUE 1 — Ampliar tabla users con campos de ciclo de vida + auditoría
-- =============================================================================
-- Verificar primero si la columna ya existe (idempotencia):
--   SHOW COLUMNS FROM users LIKE 'status';
-- Si no existe, ejecutar:

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'control_obra'
    AND TABLE_NAME   = 'users'
    AND COLUMN_NAME  = 'status'
);

SET @sql := IF(@col_exists = 0,
  'ALTER TABLE users
     ADD COLUMN status        ENUM(''PENDING'',''ACTIVE'',''SUSPENDED'') NOT NULL DEFAULT ''ACTIVE'' AFTER area,
     ADD COLUMN project_id    VARCHAR(36) NULL AFTER status,
     ADD COLUMN created_by    VARCHAR(36) NULL AFTER project_id,
     ADD COLUMN authorized_by VARCHAR(36) NULL AFTER created_by,
     ADD COLUMN authorized_at DATETIME NULL AFTER authorized_by,
     ADD COLUMN suspended_by  VARCHAR(36) NULL AFTER authorized_at,
     ADD COLUMN suspended_at  DATETIME NULL AFTER suspended_by,
     ADD INDEX idx_users_status (status)',
  'SELECT "users.status y columnas de auditoria YA EXISTEN — saltando ALTER" AS info');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================================================
-- BLOQUE 2 — Foreign Keys (sobre users.project_id, created_by, etc.)
-- =============================================================================
-- Las FKs se agregan por separado para poder validar/refactorizar fácilmente.
-- Si la FK ya existe, MySQL ignora el error 1826; pero mejor usamos SET.

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA   = 'control_obra'
    AND TABLE_NAME     = 'users'
    AND CONSTRAINT_NAME = 'fk_users_project'
);

SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE users
     ADD CONSTRAINT fk_users_project     FOREIGN KEY (project_id)    REFERENCES projects(id) ON DELETE SET NULL,
     ADD CONSTRAINT fk_users_creator     FOREIGN KEY (created_by)    REFERENCES users(id)    ON DELETE SET NULL,
     ADD CONSTRAINT fk_users_authorizer  FOREIGN KEY (authorized_by) REFERENCES users(id)    ON DELETE SET NULL,
     ADD CONSTRAINT fk_users_suspender   FOREIGN KEY (suspended_by)  REFERENCES users(id)    ON DELETE SET NULL',
  'SELECT "FKs sobre users YA EXISTEN — saltando ALTER" AS info');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================================================
-- BLOQUE 3 — Backfill: copiar invitaciones legacy PENDING/ACCEPTED a users
-- =============================================================================
-- Solo crea usuarios para correos que NO existan ya en users.
--   - status=ACCEPTED → user.status='ACTIVE', is_active=1
--   - status=PENDING  → user.status='PENDING', is_active=0
--   - area NULL → 'administrativo' por defecto

INSERT INTO users
  (id, email, name, role, area, project_id, status, is_active,
   created_by, authorized_by, authorized_at, created_at)
SELECT
  UUID()                                       AS id,
  LOWER(TRIM(i.email))                         AS email,
  COALESCE(
    (SELECT u2.name FROM users u2 WHERE LOWER(u2.email) = LOWER(i.email) LIMIT 1),
    SUBSTRING_INDEX(i.email, '@', 1)
  )                                            AS name,
  i.role                                       AS role,
  COALESCE(i.area, 'administrativo')          AS area,
  i.project_id                                 AS project_id,
  CASE WHEN i.status = 'ACCEPTED' THEN 'ACTIVE' ELSE 'PENDING' END AS status,
  CASE WHEN i.status = 'ACCEPTED' THEN 1 ELSE 0 END AS is_active,
  i.created_by                                 AS created_by,
  CASE WHEN i.status = 'ACCEPTED' THEN i.accepted_by ELSE NULL END AS authorized_by,
  CASE WHEN i.status = 'ACCEPTED' THEN i.accepted_at ELSE NULL END AS authorized_at,
  COALESCE(i.created_at, NOW())               AS created_at
FROM invitations i
WHERE i.status IN ('PENDING', 'ACCEPTED')
  AND NOT EXISTS (
    SELECT 1 FROM users u WHERE LOWER(u.email) = LOWER(i.email)
  );

-- =============================================================================
-- BLOQUE 4 — Verificación post-migración
-- =============================================================================
-- Después de ejecutar, corre estas queries para verificar:

-- 1) Estructura nueva:
--    SHOW COLUMNS FROM users;
--    SHOW CREATE TABLE users\G

-- 2) Conteo de migración:
--    SELECT status, COUNT(*) AS n FROM users GROUP BY status;

-- 3) Usuarios creados desde invitaciones:
--    SELECT id, email, role, area, status, created_by, authorized_by
--    FROM users
--    WHERE created_by IS NOT NULL
--    ORDER BY created_at DESC;

-- 4) Invitaciones legacy ya migradas (deberían seguir existiendo por auditoría):
--    SELECT status, COUNT(*) FROM invitations GROUP BY status;

-- =============================================================================
-- FIN — Si algo falla, NO es destructivo. Puedes re-ejecutar este script
-- completo y los ALTER son idempotentes por la guarda @col_exists / @fk_exists.
-- =============================================================================
