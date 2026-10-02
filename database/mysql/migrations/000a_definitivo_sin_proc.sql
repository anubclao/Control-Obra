-- =============================================================================
-- ControlObra — PARTE 1/2: Schema (columnas, constraints, tablas)
-- =============================================================================
-- Ejecutar en phpMyAdmin → BD u652436213_ControlObra → pestaña SQL
-- Pegar TODO este archivo → Continuar.
-- No usar USE: phpMyAdmin ya tiene la BD activa.
-- Idempotente: se puede correr 2 veces sin error.
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- 002 — users (status, project_id, created_by, authorized_*, suspended_*)
-- =============================================================================

-- status (ENUM con default ACTIVE)
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'status');
SET @sql := IF(@c = 0,
  'ALTER TABLE users ADD COLUMN status ENUM(''PENDING'',''ACTIVE'',''SUSPENDED'') NOT NULL DEFAULT ''ACTIVE'' AFTER area',
  'SELECT ''users.status ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- project_id
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'project_id');
SET @sql := IF(@c = 0,
  'ALTER TABLE users ADD COLUMN project_id VARCHAR(36) NULL AFTER status',
  'SELECT ''users.project_id ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- created_by
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'created_by');
SET @sql := IF(@c = 0,
  'ALTER TABLE users ADD COLUMN created_by VARCHAR(36) NULL AFTER project_id',
  'SELECT ''users.created_by ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- authorized_by
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'authorized_by');
SET @sql := IF(@c = 0,
  'ALTER TABLE users ADD COLUMN authorized_by VARCHAR(36) NULL AFTER created_by',
  'SELECT ''users.authorized_by ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- authorized_at
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'authorized_at');
SET @sql := IF(@c = 0,
  'ALTER TABLE users ADD COLUMN authorized_at DATETIME NULL AFTER authorized_by',
  'SELECT ''users.authorized_at ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- suspended_by
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'suspended_by');
SET @sql := IF(@c = 0,
  'ALTER TABLE users ADD COLUMN suspended_by VARCHAR(36) NULL AFTER authorized_at',
  'SELECT ''users.suspended_by ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- suspended_at
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'suspended_at');
SET @sql := IF(@c = 0,
  'ALTER TABLE users ADD COLUMN suspended_at DATETIME NULL AFTER suspended_by',
  'SELECT ''users.suspended_at ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_users_status
SET @i := (SELECT COUNT(*) FROM information_schema.statistics
            WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'idx_users_status');
SET @sql := IF(@i = 0,
  'CREATE INDEX idx_users_status ON users (status)',
  'SELECT ''idx_users_status ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- FK users.project_id -> projects.id
SET @k := (SELECT COUNT(*) FROM information_schema.table_constraints
            WHERE table_schema = DATABASE() AND table_name = 'users' AND constraint_name = 'fk_users_project');
SET @sql := IF(@k = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL',
  'SELECT ''fk_users_project ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- FK users.created_by -> users.id
SET @k := (SELECT COUNT(*) FROM information_schema.table_constraints
            WHERE table_schema = DATABASE() AND table_name = 'users' AND constraint_name = 'fk_users_creator');
SET @sql := IF(@k = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT ''fk_users_creator ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- FK users.authorized_by -> users.id
SET @k := (SELECT COUNT(*) FROM information_schema.table_constraints
            WHERE table_schema = DATABASE() AND table_name = 'users' AND constraint_name = 'fk_users_authorizer');
SET @sql := IF(@k = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_authorizer FOREIGN KEY (authorized_by) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT ''fk_users_authorizer ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- FK users.suspended_by -> users.id
SET @k := (SELECT COUNT(*) FROM information_schema.table_constraints
            WHERE table_schema = DATABASE() AND table_name = 'users' AND constraint_name = 'fk_users_suspender');
SET @sql := IF(@k = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_suspender FOREIGN KEY (suspended_by) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT ''fk_users_suspender ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Backfill: usuarios legacy sin status -> ACTIVE
UPDATE users SET status = 'ACTIVE' WHERE status IS NULL;

-- =============================================================================
-- 003 — Accounting (5 tablas, CREATE IF NOT EXISTS)
-- =============================================================================
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

-- =============================================================================
-- 004 — budgets: payment_terms_json, delivery_days, offer_validity_days,
--                    commercial_advisor_json
-- =============================================================================
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'budgets' AND column_name = 'payment_terms_json');
SET @sql := IF(@c = 0,
  'ALTER TABLE budgets ADD COLUMN payment_terms_json TEXT NULL AFTER unforeseen_value',
  'SELECT ''budgets.payment_terms_json ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'budgets' AND column_name = 'delivery_days');
SET @sql := IF(@c = 0,
  'ALTER TABLE budgets ADD COLUMN delivery_days INT NULL DEFAULT 0 AFTER payment_terms_json',
  'SELECT ''budgets.delivery_days ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'budgets' AND column_name = 'offer_validity_days');
SET @sql := IF(@c = 0,
  'ALTER TABLE budgets ADD COLUMN offer_validity_days INT NULL DEFAULT 30 AFTER delivery_days',
  'SELECT ''budgets.offer_validity_days ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'budgets' AND column_name = 'commercial_advisor_json');
SET @sql := IF(@c = 0,
  'ALTER TABLE budgets ADD COLUMN commercial_advisor_json TEXT NULL AFTER offer_validity_days',
  'SELECT ''budgets.commercial_advisor_json ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Backfill defensivo
UPDATE budgets
   SET delivery_days       = COALESCE(delivery_days, 0),
       offer_validity_days = COALESCE(offer_validity_days, 30)
 WHERE delivery_days IS NULL OR offer_validity_days IS NULL;

-- =============================================================================
-- 005 — contracts.pricing_mode
-- =============================================================================
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'contracts' AND column_name = 'pricing_mode');
SET @sql := IF(@c = 0,
  'ALTER TABLE contracts ADD COLUMN pricing_mode ENUM(''UNIT_PRICE'',''LUMP_SUM'',''COST_PLUS'') NULL AFTER advance_percent',
  'SELECT ''contracts.pricing_mode ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Backfill: contratos OBRA heredan UNIT_PRICE
UPDATE contracts SET pricing_mode = 'UNIT_PRICE' WHERE pricing_mode IS NULL AND type = 'OBRA';

-- =============================================================================
-- 006 — document_generation_log + generated_document_url en 6 entidades
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

-- generated_document_url en 6 entidades
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'payment_requests' AND column_name = 'generated_document_url');
SET @sql := IF(@c = 0,
  'ALTER TABLE payment_requests ADD COLUMN generated_document_url TEXT NULL',
  'SELECT ''payment_requests.generated_document_url ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'expenses' AND column_name = 'generated_document_url');
SET @sql := IF(@c = 0,
  'ALTER TABLE expenses ADD COLUMN generated_document_url TEXT NULL',
  'SELECT ''expenses.generated_document_url ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'work_cuts' AND column_name = 'generated_document_url');
SET @sql := IF(@c = 0,
  'ALTER TABLE work_cuts ADD COLUMN generated_document_url TEXT NULL',
  'SELECT ''work_cuts.generated_document_url ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'contracts' AND column_name = 'generated_document_url');
SET @sql := IF(@c = 0,
  'ALTER TABLE contracts ADD COLUMN generated_document_url TEXT NULL',
  'SELECT ''contracts.generated_document_url ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'employees' AND column_name = 'generated_document_url');
SET @sql := IF(@c = 0,
  'ALTER TABLE employees ADD COLUMN generated_document_url TEXT NULL',
  'SELECT ''employees.generated_document_url ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'work_logs' AND column_name = 'generated_document_url');
SET @sql := IF(@c = 0,
  'ALTER TABLE work_logs ADD COLUMN generated_document_url TEXT NULL',
  'SELECT ''work_logs.generated_document_url ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =============================================================================
-- 007 — auditoría del log: ip, user_agent, attempts, template_version
-- =============================================================================
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'document_generation_log' AND column_name = 'ip');
SET @sql := IF(@c = 0,
  'ALTER TABLE document_generation_log ADD COLUMN ip VARCHAR(64) NULL AFTER user_id',
  'SELECT ''document_generation_log.ip ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'document_generation_log' AND column_name = 'user_agent');
SET @sql := IF(@c = 0,
  'ALTER TABLE document_generation_log ADD COLUMN user_agent VARCHAR(255) NULL AFTER ip',
  'SELECT ''document_generation_log.user_agent ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'document_generation_log' AND column_name = 'attempts');
SET @sql := IF(@c = 0,
  'ALTER TABLE document_generation_log ADD COLUMN attempts TINYINT UNSIGNED NULL AFTER user_agent',
  'SELECT ''document_generation_log.attempts ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'document_generation_log' AND column_name = 'template_version');
SET @sql := IF(@c = 0,
  'ALTER TABLE document_generation_log ADD COLUMN template_version VARCHAR(16) NULL AFTER attempts',
  'SELECT ''document_generation_log.template_version ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =============================================================================
-- 008 — AIU: DROP chk_aiu_sum + ADD chk_aiu_range
--       (MariaDB usa DROP CONSTRAINT, no DROP CHECK como MySQL 8)
-- =============================================================================
SET @k := (SELECT COUNT(*) FROM information_schema.table_constraints
            WHERE table_schema = DATABASE() AND table_name = 'aiu_configs' AND constraint_name = 'chk_aiu_sum');
SET @sql := IF(@k > 0,
  'ALTER TABLE aiu_configs DROP CONSTRAINT chk_aiu_sum',
  'SELECT ''chk_aiu_sum ya no existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @k := (SELECT COUNT(*) FROM information_schema.table_constraints
            WHERE table_schema = DATABASE() AND table_name = 'aiu_configs' AND constraint_name = 'chk_aiu_range');
SET @sql := IF(@k = 0,
  'ALTER TABLE aiu_configs ADD CONSTRAINT chk_aiu_range CHECK (administration BETWEEN 0 AND 100 AND imprevistos BETWEEN 0 AND 100 AND utilidad BETWEEN 0 AND 100)',
  'SELECT ''chk_aiu_range ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =============================================================================
-- 009 — Control de Cambios
-- =============================================================================
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'budgets' AND column_name = 'change_order_seq');
SET @sql := IF(@c = 0,
  'ALTER TABLE budgets ADD COLUMN change_order_seq INT NOT NULL DEFAULT 0',
  'SELECT ''budgets.change_order_seq ya existe''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

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

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- FIN PARTE 1/2
-- Si no dio ningún error, correr PARTE 2/2 (000b_definitivo_verificacion.sql)
-- =============================================================================
