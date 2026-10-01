-- =============================================================================
-- ControlObra — Script de RÉPLICA para Hostinger (BD nueva)
-- =============================================================================
-- Última revisión: 2026-09-30
-- Cubre: init.sql + migrations 002..009 (alineado con los 4 commits
--        39660ff / 96cda22 / e9f62fd / 81a02ba en origin/main).
--
-- CÓMO USARLO (3 opciones, en orden de recomendación):
--
-- OPCIÓN A — desde phpMyAdmin (la más usada en Hostinger compartido)
--   1) Panel de Hostinger → Bases de datos MySQL → phpMyAdmin
--   2) Crear BD nueva con prefijo del usuario (ej. u652436213_ControlObra)
--   3) phpMyAdmin → seleccionar esa BD en el panel izquierdo
--   4) Pestaña SQL → pegar TODO este archivo → Continuar
--   5) Si tira error de "USE control_obra", ignorar (es esperado, la BD
--      real tiene prefijo del usuario)
--
-- OPCIÓN B — desde local con Node
--   cd nextjs_space
--   # en .env.local: DB_HOST, DB_PORT, DB_USER, DB_NAME (DB_PASSWORD al ejecutar)
--   node scripts/apply-migration.mjs \
--     database/mysql/migrations/000_replica_hostinger.sql
--   (te pide la contraseña de forma interactiva; no queda en el repo)
--
-- OPCIÓN C — desde local con mysql CLI
--   mysql -h $DB_HOST -P 3306 -u $DB_USER -p$DB_PASSWORD $DB_NAME \
--     < database/mysql/migrations/000_replica_hostinger.sql
--
-- GOTCHAS CONOCIDOS (leer ANTES de correr):
--
-- 1) En Hostinger la BD NO se llama "control_obra", se llama con tu
--    prefijo (ej. u652436213_ControlObra). Por eso este script NO usa
--    "USE control_obra;". Todos los guards de information_schema usan
--    DATABASE() que se resuelve a la BD activa en la sesión.
--
-- 2) Hostinger usa MariaDB 10.x, NO MySQL 8. Por eso:
--    - DROP CHECK no existe → usamos DROP CONSTRAINT
--    - ADD COLUMN IF NOT EXISTS sí funciona en MariaDB 10.0+ → lo usamos
--    - Los CREATE TABLE IF NOT EXISTS son estándar
--
-- 3) phpMyAdmin aborta el script en el primer error. Por eso este script
--    está escrito de forma que cada bloque es idempotente (puede fallar
--    y se puede re-ejecutar sin romper).
--
-- 4) El usuario MySQL de Hostinger compartido típicamente NO tiene acceso
--    a information_schema. Por eso las verificaciones finales usan
--    SHOW CREATE TABLE / SHOW COLUMNS en vez de SELECT sobre
--    information_schema.tables.
--
-- 5) Si la tabla aiu_configs se daña durante la ejecución (raro pero
--    documentado), hay un script de recuperación:
--    migrations/999_emergency_aiu_recovery.sql
--
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- 0) init.sql — DDL base (35 tablas)
-- =============================================================================
-- NOTA: init.sql tiene al inicio "DROP DATABASE IF EXISTS control_obra".
--       Si tu BD ya existe, NO LO CORRAS. En su lugar, este script
--       recrea SOLO las tablas que faltan con CREATE TABLE IF NOT EXISTS.
--       Para réplicas desde cero (BD vacía), corré init.sql primero
--       y después este script.
-- =============================================================================

-- =============================================================================
-- 1) Migración 002 — Autorización de usuarios
--    Spec: docs/specs/admin-user-authorization-with-otp.md
-- =============================================================================
-- Agrega a users: status, project_id, created_by, authorized_by/at,
-- suspended_by/at + idx_users_status + 4 FKs.

ALTER TABLE users ADD COLUMN IF NOT EXISTS status ENUM('PENDING','ACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE' AFTER area;
ALTER TABLE users ADD COLUMN IF NOT EXISTS project_id VARCHAR(36) NULL AFTER status;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by VARCHAR(36) NULL AFTER project_id;
ALTER TABLE users ADD COLUMN IF NOT EXISTS authorized_by VARCHAR(36) NULL AFTER created_by;
ALTER TABLE users ADD COLUMN IF NOT EXISTS authorized_at DATETIME NULL AFTER authorized_by;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_by VARCHAR(36) NULL AFTER authorized_at;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at DATETIME NULL AFTER suspended_by;
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

-- FKs (con guard vía CREATE PROCEDURE si no existe — ver init.sql).
-- En Hostinger, si el usuario no puede crear FKs, omitir este bloque.
-- ALTER TABLE users ADD CONSTRAINT fk_users_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
-- ALTER TABLE users ADD CONSTRAINT fk_users_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
-- ALTER TABLE users ADD CONSTRAINT fk_users_authorizer FOREIGN KEY (authorized_by) REFERENCES users(id) ON DELETE SET NULL;
-- ALTER TABLE users ADD CONSTRAINT fk_users_suspender FOREIGN KEY (suspended_by) REFERENCES users(id) ON DELETE SET NULL;

UPDATE users SET status = 'ACTIVE' WHERE status IS NULL;

-- =============================================================================
-- 2) Migración 003 — Módulo de Contabilidad
--    Spec: docs/specs/accounting-module.md
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
-- 3) Migración 004 — Condiciones comerciales en presupuestos (PT)
--    Spec: docs/specs/gap-analysis-cliente-control-cambios.md §3.1
-- =============================================================================
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS payment_terms_json      TEXT NULL AFTER unforeseen_value;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS delivery_days           INT  NULL DEFAULT 0  AFTER payment_terms_json;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS offer_validity_days     INT  NULL DEFAULT 30 AFTER delivery_days;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS commercial_advisor_json TEXT NULL AFTER offer_validity_days;

UPDATE budgets
   SET delivery_days       = COALESCE(delivery_days, 0),
       offer_validity_days = COALESCE(offer_validity_days, 30)
 WHERE delivery_days IS NULL OR offer_validity_days IS NULL;

-- =============================================================================
-- 4) Migración 005 — Modalidad de contratación
--    Spec: docs/specs/gap-analysis-cliente-control-cambios.md §3.3
-- =============================================================================
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS pricing_mode ENUM('UNIT_PRICE','LUMP_SUM','COST_PLUS') NULL AFTER advance_percent;

UPDATE contracts SET pricing_mode = 'UNIT_PRICE' WHERE pricing_mode IS NULL AND type = 'OBRA';

-- =============================================================================
-- 5) Migración 006 — Generación de documentos
--    Spec: docs/specs/document-generation-sharepoint.md
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

ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS generated_document_url TEXT NULL;
ALTER TABLE expenses         ADD COLUMN IF NOT EXISTS generated_document_url TEXT NULL;
ALTER TABLE work_cuts        ADD COLUMN IF NOT EXISTS generated_document_url TEXT NULL;
ALTER TABLE contracts        ADD COLUMN IF NOT EXISTS generated_document_url TEXT NULL;
ALTER TABLE employees        ADD COLUMN IF NOT EXISTS generated_document_url TEXT NULL;
ALTER TABLE work_logs        ADD COLUMN IF NOT EXISTS generated_document_url TEXT NULL;

-- =============================================================================
-- 6) Migración 007 — Auditoría del log de documentos
--    Spec: docs/specs/document-generation-sharepoint.md §F4
-- =============================================================================
ALTER TABLE document_generation_log ADD COLUMN IF NOT EXISTS ip               VARCHAR(64)  NULL AFTER user_id;
ALTER TABLE document_generation_log ADD COLUMN IF NOT EXISTS user_agent       VARCHAR(255) NULL AFTER ip;
ALTER TABLE document_generation_log ADD COLUMN IF NOT EXISTS attempts         TINYINT UNSIGNED NULL AFTER user_agent;
ALTER TABLE document_generation_log ADD COLUMN IF NOT EXISTS template_version VARCHAR(16)  NULL AFTER attempts;

-- =============================================================================
-- 7) Migración 008 — AIU como % sobre costo directo
--    Spec: docs/specs/bug-aiu-porcentaje-sobre-costo-directo.md
--    MariaDB: DROP CONSTRAINT (no DROP CHECK)
-- =============================================================================
ALTER TABLE aiu_configs DROP CONSTRAINT IF EXISTS chk_aiu_sum;
ALTER TABLE aiu_configs DROP CONSTRAINT IF EXISTS chk_aiu_range;
ALTER TABLE aiu_configs ADD  CONSTRAINT chk_aiu_range CHECK (
  administration BETWEEN 0 AND 100
  AND imprevistos BETWEEN 0 AND 100
  AND utilidad    BETWEEN 0 AND 100
);

-- =============================================================================
-- 8) Migración 009 — Control de Cambios del presupuesto (CC-001, CC-002…)
--    Spec: docs/specs/budget-change-control.md
-- =============================================================================
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS change_order_seq INT NOT NULL DEFAULT 0;

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
  INDEX idx_bco_budget_seq (budget_id, seq),
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
  INDEX idx_bcoi_co (change_order_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- FIN DEL SCRIPT DE RÉPLICA
-- Después de correrlo, hacer SHOW CREATE TABLE de las tablas clave
-- para confirmar. Ver: migrations/REPLICA_CHECKLIST.md
-- =============================================================================
