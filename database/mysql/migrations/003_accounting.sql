-- =============================================================================
-- Migración 003 — Módulo de Contabilidad
-- =============================================================================
-- Spec: docs/specs/accounting-module.md
-- Aplica a: control_obra (MySQL 8.0+ / MariaDB 10.5+)
--
-- IMPORTANTE — Ejecutar manualmente desde tu cliente MySQL o panel Hostinger.
-- Esta migración es ADITIVA: crea 5 tablas nuevas y no toca ninguna existente.
--
-- Notas de diseño:
--   - project_id NULL = alcance "General" (empresa), no un proyecto concreto.
--     Por eso el FK es ON DELETE SET NULL: si se borra el proyecto, el
--     movimiento contable sobrevive a nivel general (no se pierde plata).
--   - El SALDO ACTUAL de una cuenta NO se guarda: se calcula sumando los
--     movimientos PAGADOS sobre opening_balance (ver src/lib/accounting.ts).
--     Así nunca se desincroniza.
--   - accounting_tax_movements son movimientos (declarado/pagado); las TASAS
--     siguen viviendo en tax_configs.
-- =============================================================================

USE control_obra;

-- -----------------------------------------------------------------------------
-- 1. Cuentas de tesorería
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounting_accounts (
  id               VARCHAR(36)    NOT NULL PRIMARY KEY,
  name             VARCHAR(180)   NOT NULL,
  type             ENUM('CORRIENTE','AHORROS','TARJETA_CREDITO','EFECTIVO','PAYPAL','OTRA')
                                  NOT NULL DEFAULT 'CORRIENTE',
  opening_balance  DECIMAL(16,2)  NOT NULL DEFAULT 0,
  notes            TEXT,
  is_active        TINYINT(1)     NOT NULL DEFAULT 1,
  created_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_acc_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Ingresos
-- -----------------------------------------------------------------------------
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
  CONSTRAINT fk_acc_income_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_acc_income_account FOREIGN KEY (account_id) REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
  INDEX idx_acc_income_project (project_id),
  INDEX idx_acc_income_status (status),
  INDEX idx_acc_income_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Gastos contables
-- -----------------------------------------------------------------------------
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
  status         ENUM('POR_PAGAR','APROBADO','URGENTE','NO_PAGAR','RETEGARANTIA','PAGADO')
                                NOT NULL DEFAULT 'POR_PAGAR',
  account_id     VARCHAR(36)    NULL,
  created_by     VARCHAR(36)    NULL,
  created_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_acc_expense_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_acc_expense_account FOREIGN KEY (account_id) REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
  INDEX idx_acc_expense_project (project_id),
  INDEX idx_acc_expense_status (status),
  INDEX idx_acc_expense_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. Movimientos de impuestos (declarados / pagados)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounting_tax_movements (
  id           VARCHAR(36)    NOT NULL PRIMARY KEY,
  date         DATE           NOT NULL,
  project_id   VARCHAR(36)    NULL,
  authority    VARCHAR(180)   NOT NULL DEFAULT 'DIAN',
  description  VARCHAR(255)   NOT NULL DEFAULT '',
  amount       DECIMAL(16,2)  NOT NULL DEFAULT 0,
  status       ENUM('DECLARADO','PAGADO') NOT NULL DEFAULT 'DECLARADO',
  account_id   VARCHAR(36)    NULL,
  created_by   VARCHAR(36)    NULL,
  created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_acc_tax_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_acc_tax_account FOREIGN KEY (account_id) REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
  INDEX idx_acc_tax_project (project_id),
  INDEX idx_acc_tax_status (status),
  INDEX idx_acc_tax_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. Metas mensuales por alcance
-- -----------------------------------------------------------------------------
-- scope_key existe porque MySQL permite duplicados en UNIQUE cuando la columna
-- es NULL: guardamos '__GENERAL__' para el alcance sin proyecto y así la meta
-- general también es única.
CREATE TABLE IF NOT EXISTS accounting_goals (
  id              VARCHAR(36)    NOT NULL PRIMARY KEY,
  project_id      VARCHAR(36)    NULL,
  scope_key       VARCHAR(40)    NOT NULL DEFAULT '__GENERAL__',
  monthly_income  DECIMAL(16,2)  NOT NULL DEFAULT 0,
  max_expense     DECIMAL(16,2)  NOT NULL DEFAULT 0,
  monthly_savings DECIMAL(16,2)  NOT NULL DEFAULT 0,
  created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_acc_goal_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE KEY uq_acc_goal_scope (scope_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Verificación
-- -----------------------------------------------------------------------------
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema = 'control_obra' AND table_name LIKE 'accounting_%';
-- Debe devolver 5 filas.
