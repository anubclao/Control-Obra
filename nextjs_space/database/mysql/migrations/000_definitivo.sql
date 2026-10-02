-- =============================================================================
-- ControlObra — Script DEFINITIVO de alineación de BD (idempotente, sin pérdida de datos)
-- =============================================================================
-- Fecha: 2026-09-30
-- Origen: 4 commits en origin/main (25451e5..81a02ba) +
--         init.sql + migrations 002..009
-- Objetivo: dejar la BD de Hostinger exactamente en el estado que espera
--           el código actual, SIN borrar tablas ni datos existentes.
--
-- IMPORTANTE: este script NO incluye DROP DATABASE ni CREATE DATABASE.
-- Solo modifica/crea lo que falte para alinear con init.sql + migrations.
-- Es 100 % idempotente: podés correrlo 2 veces sin romper nada.
--
-- Uso en Hostinger (phpMyAdmin):
--   1) BD: control_obra
--   2) Pestaña SQL → pegar TODO este archivo → Continuar
--
-- Uso desde local (alternativa, más prolija con la salida):
--   node scripts/apply-migration.mjs database/mysql/migrations/000_definitivo.sql
--
-- Pre-requisito: init.sql ya corrido (tablas base existen).
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO,STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION";
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- NO usar "USE control_obra;" en Hostinger: la BD real tiene prefijo
-- del usuario (ej. u652436213_ControlObra). phpMyAdmin ya tiene la BD
-- activa al seleccionarla en el panel izquierdo. Este script usa
-- DATABASE() en todos los guards de information_schema para que sea
-- agnóstico al nombre real de la BD.
-- USE control_obra;

-- =============================================================================
-- 0) Helper: bloque idempotente para "ADD COLUMN si no existe"
-- =============================================================================
-- MySQL 8.0.46 no soporta "ADD COLUMN IF NOT EXISTS" en ALTER TABLE.
-- Usamos information_schema + PREPARE para que re-ejecuciones no fallen.
-- Ejemplo:
--   CALL add_column_if_missing('tabla','columna','TIPO NULL AFTER otra_col');

DROP PROCEDURE IF EXISTS add_column_if_missing;
DELIMITER //
CREATE PROCEDURE add_column_if_missing(
  IN p_table  VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_ddl    TEXT
)
BEGIN
  SET @exists := (
    SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name   = p_table
       AND column_name  = p_column
  );
  IF @exists = 0 THEN
    SET @sql := p_ddl;
  ELSE
    SET @sql := CONCAT('SELECT "', p_column, ' ya existe en ', p_table, ' — saltando" AS info');
  END IF;
  PREPARE stmt FROM @sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
END //
DELIMITER ;

-- =============================================================================
-- 1) Migración 002 — Autorización de usuarios
--    Spec: docs/specs/admin-user-authorization-with-otp.md
-- =============================================================================
-- users.status, users.project_id, users.created_by, users.authorized_by,
-- users.authorized_at, users.suspended_by, users.suspended_at + idx_users_status

CALL add_column_if_missing('users','status',
  'ALTER TABLE users ADD COLUMN status ENUM(''PENDING'',''ACTIVE'',''SUSPENDED'') NOT NULL DEFAULT ''ACTIVE'' AFTER area');
CALL add_column_if_missing('users','project_id',
  'ALTER TABLE users ADD COLUMN project_id VARCHAR(36) NULL AFTER status');
CALL add_column_if_missing('users','created_by',
  'ALTER TABLE users ADD COLUMN created_by VARCHAR(36) NULL AFTER project_id');
CALL add_column_if_missing('users','authorized_by',
  'ALTER TABLE users ADD COLUMN authorized_by VARCHAR(36) NULL AFTER created_by');
CALL add_column_if_missing('users','authorized_at',
  'ALTER TABLE users ADD COLUMN authorized_at DATETIME NULL AFTER authorized_by');
CALL add_column_if_missing('users','suspended_by',
  'ALTER TABLE users ADD COLUMN suspended_by VARCHAR(36) NULL AFTER authorized_at');
CALL add_column_if_missing('users','suspended_at',
  'ALTER TABLE users ADD COLUMN suspended_at DATETIME NULL AFTER suspended_by');

-- idx_users_status (no se puede usar el helper porque no es ADD COLUMN,
-- sino CREATE INDEX; usamos un guard equivalente)
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'idx_users_status'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_users_status ON users (status)',
  'SELECT "idx_users_status ya existe — saltando" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Foreign keys (solo si faltan)
SET @fk := (SELECT COUNT(*) FROM information_schema.table_constraints
             WHERE table_schema=DATABASE() AND table_name='users'
               AND constraint_name='fk_users_project');
SET @sql := IF(@fk = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL',
  'SELECT "fk_users_project ya existe — saltando" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.table_constraints
             WHERE table_schema=DATABASE() AND table_name='users'
               AND constraint_name='fk_users_creator');
SET @sql := IF(@fk = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT "fk_users_creator ya existe — saltando" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.table_constraints
             WHERE table_schema=DATABASE() AND table_name='users'
               AND constraint_name='fk_users_authorizer');
SET @sql := IF(@fk = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_authorizer FOREIGN KEY (authorized_by) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT "fk_users_authorizer ya existe — saltando" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.table_constraints
             WHERE table_schema=DATABASE() AND table_name='users'
               AND constraint_name='fk_users_suspender');
SET @sql := IF(@fk = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_suspender FOREIGN KEY (suspended_by) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT "fk_users_suspender ya existe — saltando" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill defensivo: usuarios sin status (legacy) quedan en ACTIVE
UPDATE users SET status = 'ACTIVE' WHERE status IS NULL;

-- =============================================================================
-- 2) Migración 003 — Módulo de Contabilidad
--    Spec: docs/specs/accounting-module.md
-- =============================================================================
-- Tablas NUEVAS: accounting_accounts, accounting_incomes, accounting_expenses,
--                accounting_tax_movements, accounting_retefuente_movements
-- (CREATE TABLE IF NOT EXISTS ya son idempotentes)

CREATE TABLE IF NOT EXISTS accounting_accounts (
  id               VARCHAR(36)    NOT NULL PRIMARY KEY,
  name             VARCHAR(180)   NOT NULL,
  type             ENUM('CORRIENTE','AHORROS','TARJETA_CREDITO','EFECTIVO','PAYPAL','OTRA') NOT NULL DEFAULT 'CORRIENTE',
  opening_balance  DECIMAL(16,2)  NOT NULL DEFAULT 0,
  notes            TEXT,
  is_active        TINYINT(1)     NOT NULL DEFAULT 1,
  created_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_acc_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS accounting_incomes (
  id           VARCHAR(36)    NOT NULL PRIMARY KEY,
  date         DATE           NOT NULL,
  project_id   VARCHAR(36)    NULL,
  cost_center  VARCHAR(180)   NOT NULL DEFAULT '',
  creator      VARCHAR(180)   NOT NULL DEFAULT '',
  client_name  VARCHAR(180)   NOT NULL DEFAULT '',
  invoice      VARCHAR(180)   NOT NULL DEFAULT '',
  amount       DECIMAL(16,2)  NOT NULL DEFAULT 0,
  taxes        DECIMAL(16,2)  NOT NULL DEFAULT 0,
  status       ENUM('POR_PAGAR','PAGADO') NOT NULL DEFAULT 'POR_PAGAR',
  account_id   VARCHAR(36)    NULL,
  paid_amount  DECIMAL(16,2)  NULL,
  created_by   VARCHAR(36)    NULL,
  created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_acc_income_project (project_id),
  INDEX idx_acc_income_status  (status),
  INDEX idx_acc_income_date    (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS accounting_expenses (
  id             VARCHAR(36)    NOT NULL PRIMARY KEY,
  date           DATE           NOT NULL,
  project_id     VARCHAR(36)    NULL,
  cost_center    VARCHAR(180)   NOT NULL DEFAULT '',
  responsible    VARCHAR(180)   NOT NULL DEFAULT '',
  provider_name  VARCHAR(180)   NOT NULL DEFAULT '',
  concept        VARCHAR(255)   NOT NULL DEFAULT '',
  detail         TEXT,
  amount         DECIMAL(16,2)  NOT NULL DEFAULT 0,
  status         ENUM('POR_PAGAR','APROBADO','URGENTE','NO_PAGAR','RETEGARANTIA','PAGADO') NOT NULL DEFAULT 'POR_PAGAR',
  account_id     VARCHAR(36)    NULL,
  paid_amount    DECIMAL(16,2)  NULL,
  created_by     VARCHAR(36)    NULL,
  created_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_acc_exp_project (project_id),
  INDEX idx_acc_exp_status  (status),
  INDEX idx_acc_exp_date    (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Las otras 2 (tax_movements, retefuente_movements) las crea init.sql si no
-- existen; si tu versión previa no las tenía, ver spec accounting-module.md §3.

-- =============================================================================
-- 3) Migración 004 — Condiciones comerciales en presupuestos
--    Spec: docs/specs/gap-analysis-cliente-control-cambios.md §3.1
-- =============================================================================
CALL add_column_if_missing('budgets','payment_terms_json',
  'ALTER TABLE budgets ADD COLUMN payment_terms_json TEXT NULL AFTER unforeseen_value');
CALL add_column_if_missing('budgets','delivery_days',
  'ALTER TABLE budgets ADD COLUMN delivery_days INT NULL DEFAULT 0 AFTER payment_terms_json');
CALL add_column_if_missing('budgets','offer_validity_days',
  'ALTER TABLE budgets ADD COLUMN offer_validity_days INT NULL DEFAULT 30 AFTER delivery_days');
CALL add_column_if_missing('budgets','commercial_advisor_json',
  'ALTER TABLE budgets ADD COLUMN commercial_advisor_json TEXT NULL AFTER offer_validity_days');

-- Backfill defensivo de defaults razonables
UPDATE budgets
   SET delivery_days       = COALESCE(delivery_days, 0),
       offer_validity_days = COALESCE(offer_validity_days, 30)
 WHERE delivery_days IS NULL OR offer_validity_days IS NULL;

-- =============================================================================
-- 4) Migración 005 — Modalidad de contratación
--    Spec: docs/specs/gap-analysis-cliente-control-cambios.md §3.3
-- =============================================================================
CALL add_column_if_missing('contracts','pricing_mode',
  "ALTER TABLE contracts ADD COLUMN pricing_mode ENUM('UNIT_PRICE','LUMP_SUM','COST_PLUS') NULL AFTER advance_percent");

-- Backfill opcional: contratos OBRA heredan UNIT_PRICE (default del PDF cliente)
UPDATE contracts
   SET pricing_mode = 'UNIT_PRICE'
 WHERE pricing_mode IS NULL AND type = 'OBRA';

-- =============================================================================
-- 5) Migración 006 — Generación de documentos
--    Spec: docs/specs/document-generation-sharepoint.md §4.5
-- =============================================================================
CREATE TABLE IF NOT EXISTS document_generation_log (
  id              CHAR(36) PRIMARY KEY,
  entity          VARCHAR(32) NOT NULL,
  entity_id       CHAR(36) NOT NULL,
  template_id     VARCHAR(32) NOT NULL,
  file_name       VARCHAR(255) NOT NULL,
  sharepoint_path TEXT NOT NULL,
  web_url         TEXT NOT NULL,
  status          ENUM('OK','ERROR') NOT NULL,
  error_code      VARCHAR(64) NULL,
  duration_ms     INT UNSIGNED NOT NULL,
  user_id         CHAR(36) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_entity  (entity, entity_id),
  INDEX idx_created (created_at),
  INDEX idx_status  (status),
  INDEX idx_template(template_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- generated_document_url en 6 entidades (idempotente)
CALL add_column_if_missing('payment_requests','generated_document_url',
  'ALTER TABLE payment_requests ADD COLUMN generated_document_url TEXT NULL');
CALL add_column_if_missing('expenses','generated_document_url',
  'ALTER TABLE expenses ADD COLUMN generated_document_url TEXT NULL');
CALL add_column_if_missing('work_cuts','generated_document_url',
  'ALTER TABLE work_cuts ADD COLUMN generated_document_url TEXT NULL');
CALL add_column_if_missing('contracts','generated_document_url',
  'ALTER TABLE contracts ADD COLUMN generated_document_url TEXT NULL');
CALL add_column_if_missing('employees','generated_document_url',
  'ALTER TABLE employees ADD COLUMN generated_document_url TEXT NULL');
CALL add_column_if_missing('work_logs','generated_document_url',
  'ALTER TABLE work_logs ADD COLUMN generated_document_url TEXT NULL');

-- =============================================================================
-- 6) Migración 007 — Auditoría de generación de documentos
--    Spec: docs/specs/document-generation-sharepoint.md §F4
-- =============================================================================
CALL add_column_if_missing('document_generation_log','ip',
  'ALTER TABLE document_generation_log ADD COLUMN ip VARCHAR(64) NULL AFTER user_id');
CALL add_column_if_missing('document_generation_log','user_agent',
  'ALTER TABLE document_generation_log ADD COLUMN user_agent VARCHAR(255) NULL AFTER ip');
CALL add_column_if_missing('document_generation_log','attempts',
  'ALTER TABLE document_generation_log ADD COLUMN attempts TINYINT UNSIGNED NULL AFTER user_agent');
CALL add_column_if_missing('document_generation_log','template_version',
  'ALTER TABLE document_generation_log ADD COLUMN template_version VARCHAR(16) NULL AFTER attempts');

-- =============================================================================
-- 7) Migración 008 — AIU como % sobre costo directo
--    Spec: docs/specs/bug-aiu-porcentaje-sobre-costo-directo.md
-- =============================================================================
-- 7a) DROP chk_aiu_sum (regla vieja: A+I+U=100)
SET @has_old := (
  SELECT COUNT(*) FROM information_schema.table_constraints
   WHERE table_schema = DATABASE() AND table_name = 'aiu_configs'
     AND constraint_name = 'chk_aiu_sum'
);
SET @sql := IF(@has_old > 0,
  'ALTER TABLE aiu_configs DROP CHECK chk_aiu_sum',
  'SELECT "chk_aiu_sum ya no existe — saltando" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 7b) ADD chk_aiu_range (nueva: 0-100 por componente)
SET @has_new := (
  SELECT COUNT(*) FROM information_schema.table_constraints
   WHERE table_schema = DATABASE() AND table_name = 'aiu_configs'
     AND constraint_name = 'chk_aiu_range'
);
SET @sql := IF(@has_new = 0,
  "ALTER TABLE aiu_configs ADD CONSTRAINT chk_aiu_range CHECK (
     administration BETWEEN 0 AND 100
     AND imprevistos    BETWEEN 0 AND 100
     AND utilidad       BETWEEN 0 AND 100)",
  'SELECT "chk_aiu_range ya existe — saltando" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 7c) Auditoría: AIU viejos (suma > 40) → reconfigurar en la UI
--     (NO se modifican datos automáticamente; el operador decide)
SELECT project_id, administration AS A, imprevistos AS I, utilidad AS U,
       administration + imprevistos + utilidad AS aiu_total
  FROM aiu_configs
 WHERE administration + imprevistos + utilidad > 40;

-- =============================================================================
-- 8) Migración 009 — Control de Cambios del presupuesto
--    Spec: docs/specs/budget-change-control.md
-- =============================================================================
CALL add_column_if_missing('budgets','change_order_seq',
  'ALTER TABLE budgets ADD COLUMN change_order_seq INT NOT NULL DEFAULT 0');

CREATE TABLE IF NOT EXISTS budget_change_orders (
  id                     VARCHAR(36)   NOT NULL PRIMARY KEY,
  budget_id              VARCHAR(36)   NOT NULL,
  seq                    INT           NOT NULL,
  number                 VARCHAR(12)   NOT NULL,
  issue_date             DATE          NOT NULL,
  request_channel        ENUM('ACTA_COMITE','MAIL','SOLICITUD_VERBAL','OTROS') NOT NULL,
  request_channel_other  VARCHAR(255)  NULL,
  description            TEXT          NOT NULL,
  advisor_name           VARCHAR(255)  NULL,
  aiu_administration     DECIMAL(5,2)  NOT NULL,
  aiu_imprevistos        DECIMAL(5,2)  NOT NULL,
  aiu_utilidad           DECIMAL(5,2)  NOT NULL,
  iva_on_utility_pct     DECIMAL(5,2)  NOT NULL DEFAULT 19,
  direct_cost            DECIMAL(15,2) NOT NULL DEFAULT 0,
  total                  DECIMAL(15,2) NOT NULL DEFAULT 0,
  status                 ENUM('DRAFT','SUBMITTED','APPROVED','REJECTED') NOT NULL DEFAULT 'DRAFT',
  rejection_reason       TEXT          NULL,
  resulting_version_id   VARCHAR(36)   NULL,
  created_by             VARCHAR(36)   NULL,
  submitted_by           VARCHAR(36)   NULL,
  submitted_at           DATETIME      NULL,
  approved_by            VARCHAR(36)   NULL,
  approved_at            DATETIME      NULL,
  rejected_by            VARCHAR(36)   NULL,
  rejected_at            DATETIME      NULL,
  created_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bco_budget   FOREIGN KEY (budget_id)            REFERENCES budgets(id)         ON DELETE CASCADE,
  CONSTRAINT fk_bco_version  FOREIGN KEY (resulting_version_id) REFERENCES budget_versions(id) ON DELETE SET NULL,
  CONSTRAINT fk_bco_creator  FOREIGN KEY (created_by)           REFERENCES users(id)           ON DELETE SET NULL,
  UNIQUE KEY uk_bco_budget_seq (budget_id, seq),
  INDEX idx_bco_budget_status (budget_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS budget_change_order_items (
  id               VARCHAR(36)   NOT NULL PRIMARY KEY,
  change_order_id  VARCHAR(36)   NOT NULL,
  position         INT           NOT NULL DEFAULT 0,
  chapter_code     VARCHAR(20)   NULL,
  item_code        VARCHAR(40)   NULL,
  description      VARCHAR(500)  NOT NULL,
  unit             VARCHAR(20)   NOT NULL,
  quantity         DECIMAL(15,3) NOT NULL DEFAULT 0,
  unit_price       DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_price      DECIMAL(15,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_bcoi_co FOREIGN KEY (change_order_id) REFERENCES budget_change_orders(id) ON DELETE CASCADE,
  INDEX idx_bcoi_co (change_order_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 9) Limpieza del helper (idempotente)
-- =============================================================================
DROP PROCEDURE IF EXISTS add_column_if_missing;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- 10) Verificación final (espera: 0 filas devueltas, todas las cuentas OK)
-- =============================================================================
SELECT 'A. users.status' AS check_name,
       (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema=DATABASE() AND table_name='users' AND column_name='status') AS expected_1,
       1 AS must_be_1;

SELECT 'B. contracts.pricing_mode' AS check_name,
       (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema=DATABASE() AND table_name='contracts' AND column_name='pricing_mode') AS expected_1,
       1 AS must_be_1;

SELECT 'C. document_generation_log' AS check_name,
       (SELECT COUNT(*) FROM information_schema.tables
         WHERE table_schema=DATABASE() AND table_name='document_generation_log') AS expected_1,
       1 AS must_be_1;

SELECT 'D. budget_change_orders' AS check_name,
       (SELECT COUNT(*) FROM information_schema.tables
         WHERE table_schema=DATABASE() AND table_name='budget_change_orders') AS expected_1,
       1 AS must_be_1;

SELECT 'E. budget_change_order_items' AS check_name,
       (SELECT COUNT(*) FROM information_schema.tables
         WHERE table_schema=DATABASE() AND table_name='budget_change_order_items') AS expected_1,
       1 AS must_be_1;

SELECT 'F. chk_aiu_range' AS check_name,
       (SELECT COUNT(*) FROM information_schema.table_constraints
         WHERE table_schema=DATABASE() AND table_name='aiu_configs' AND constraint_name='chk_aiu_range') AS expected_1,
       1 AS must_be_1;

SELECT 'G. chk_aiu_sum (debe ser 0)' AS check_name,
       (SELECT COUNT(*) FROM information_schema.table_constraints
         WHERE table_schema=DATABASE() AND table_name='aiu_configs' AND constraint_name='chk_aiu_sum') AS expected_0,
       0 AS must_be_0;

SELECT 'H. budgets.change_order_seq' AS check_name,
       (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema=DATABASE() AND table_name='budgets' AND column_name='change_order_seq') AS expected_1,
       1 AS must_be_1;

-- Fin del script. Si todos los checks dan expected=must_be, la BD está al día.
