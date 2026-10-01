-- =============================================================================
-- Migracion 011: campos de auditoria + soft delete en tablas transaccionales.
--
-- P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.2):
--   - `updated_by` no existe en ninguna tabla. Lo agregamos para saber
--     quien edita cada registro.
--   - `deleted_at` solo existe en `projects` (migracion 010). Lo
--     replicamos en el resto de tablas transaccionales para que
--     `DELETE` fisico no rompa la auditoria.
--   - `clients.created_by` y `clients.owner_id` faltan: no se sabe
--     quien dio de alta al cliente ni quien es el responsable comercial.
--
-- Idempotente: cada ALTER chequea information_schema antes de aplicar.
-- =============================================================================

-- Macro de chequeo: SELECT 1 cuando la columna ya existe.
-- En MySQL puro no hay DO $$ como en Postgres, asi que se hace con
-- PREPARE/EVALUATE por columna.

-- ============================================================================
-- 1) `payment_requests` (sin tocar la columna `status` ni timestamps)
-- ============================================================================
SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'payment_requests'
               AND column_name = 'updated_by');
SET @sql := IF(@col = 0,
  'ALTER TABLE payment_requests ADD COLUMN updated_by VARCHAR(36) NULL DEFAULT NULL AFTER created_by',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'payment_requests'
               AND column_name = 'deleted_at');
SET @sql := IF(@col = 0,
  'ALTER TABLE payment_requests ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL AFTER updated_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'payment_requests'
               AND column_name = 'deleted_by');
SET @sql := IF(@col = 0,
  'ALTER TABLE payment_requests ADD COLUMN deleted_by VARCHAR(36) NULL DEFAULT NULL AFTER deleted_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
             WHERE table_schema = DATABASE() AND table_name = 'payment_requests'
               AND index_name = 'idx_pay_deleted_at');
SET @sql := IF(@idx = 0,
  'CREATE INDEX idx_pay_deleted_at ON payment_requests (deleted_at)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- 2) `work_cuts`
-- ============================================================================
SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'work_cuts'
               AND column_name = 'updated_by');
SET @sql := IF(@col = 0,
  'ALTER TABLE work_cuts ADD COLUMN updated_by VARCHAR(36) NULL DEFAULT NULL AFTER created_by',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'work_cuts'
               AND column_name = 'deleted_at');
SET @sql := IF(@col = 0,
  'ALTER TABLE work_cuts ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL AFTER updated_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'work_cuts'
               AND column_name = 'deleted_by');
SET @sql := IF(@col = 0,
  'ALTER TABLE work_cuts ADD COLUMN deleted_by VARCHAR(36) NULL DEFAULT NULL AFTER deleted_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
             WHERE table_schema = DATABASE() AND table_name = 'work_cuts'
               AND index_name = 'idx_wcut_deleted_at');
SET @sql := IF(@idx = 0,
  'CREATE INDEX idx_wcut_deleted_at ON work_cuts (deleted_at)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- 3) `work_logs` (tambien faltaba updated_at segun docs)
-- ============================================================================
SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'work_logs'
               AND column_name = 'updated_by');
SET @sql := IF(@col = 0,
  'ALTER TABLE work_logs ADD COLUMN updated_by VARCHAR(36) NULL DEFAULT NULL AFTER created_by_name',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'work_logs'
               AND column_name = 'updated_at');
SET @sql := IF(@col = 0,
  'ALTER TABLE work_logs ADD COLUMN updated_at DATETIME NULL DEFAULT NULL AFTER created_at ON UPDATE CURRENT_TIMESTAMP',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'work_logs'
               AND column_name = 'deleted_at');
SET @sql := IF(@col = 0,
  'ALTER TABLE work_logs ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'work_logs'
               AND column_name = 'deleted_by');
SET @sql := IF(@col = 0,
  'ALTER TABLE work_logs ADD COLUMN deleted_by VARCHAR(36) NULL DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- 4) `clients` — auditoria + owner_id + deleted_at
-- ============================================================================
SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'clients'
               AND column_name = 'created_by');
SET @sql := IF(@col = 0,
  'ALTER TABLE clients ADD COLUMN created_by VARCHAR(36) NULL DEFAULT NULL AFTER notes',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'clients'
               AND column_name = 'owner_id');
SET @sql := IF(@col = 0,
  'ALTER TABLE clients ADD COLUMN owner_id VARCHAR(36) NULL DEFAULT NULL AFTER created_by',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'clients'
               AND column_name = 'updated_by');
SET @sql := IF(@col = 0,
  'ALTER TABLE clients ADD COLUMN updated_by VARCHAR(36) NULL DEFAULT NULL AFTER owner_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'clients'
               AND column_name = 'deleted_at');
SET @sql := IF(@col = 0,
  'ALTER TABLE clients ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'clients'
               AND column_name = 'deleted_by');
SET @sql := IF(@col = 0,
  'ALTER TABLE clients ADD COLUMN deleted_by VARCHAR(36) NULL DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
             WHERE table_schema = DATABASE() AND table_name = 'clients'
               AND index_name = 'idx_cli_deleted_at');
SET @sql := IF(@idx = 0,
  'CREATE INDEX idx_cli_deleted_at ON clients (deleted_at)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
             WHERE table_schema = DATABASE() AND table_name = 'clients'
               AND index_name = 'idx_cli_owner');
SET @sql := IF(@idx = 0,
  'CREATE INDEX idx_cli_owner ON clients (owner_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- 5) `quotations`
-- ============================================================================
SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'quotations'
               AND column_name = 'updated_by');
SET @sql := IF(@col = 0,
  'ALTER TABLE quotations ADD COLUMN updated_by VARCHAR(36) NULL DEFAULT NULL AFTER created_by',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'quotations'
               AND column_name = 'deleted_at');
SET @sql := IF(@col = 0,
  'ALTER TABLE quotations ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'quotations'
               AND column_name = 'deleted_by');
SET @sql := IF(@col = 0,
  'ALTER TABLE quotations ADD COLUMN deleted_by VARCHAR(36) NULL DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
             WHERE table_schema = DATABASE() AND table_name = 'quotations'
               AND index_name = 'idx_quot_deleted_at');
SET @sql := IF(@idx = 0,
  'CREATE INDEX idx_quot_deleted_at ON quotations (deleted_at)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
