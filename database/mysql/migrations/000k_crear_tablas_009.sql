-- =============================================================================
-- 000k — Crear tablas de Control de Cambios (009) que faltan
-- =============================================================================
-- Migración: docs/specs/budget-change-control.md
-- Tablas: budget_change_orders, budget_change_order_items
-- Columna: budgets.change_order_seq
--
-- Seguro de re-ejecutar: usa CREATE TABLE IF NOT EXISTS y
-- ADD COLUMN IF NOT EXISTS (soportado en MariaDB 10.0+).
-- =============================================================================

-- 1) Columna change_order_seq en budgets
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS change_order_seq INT NOT NULL DEFAULT 0;

-- 2) Tabla cabecera de los CC
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

-- 3) Tabla de ítems de cada CC
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

-- 4) Verificación
SHOW COLUMNS FROM budgets LIKE 'change_order_seq';
