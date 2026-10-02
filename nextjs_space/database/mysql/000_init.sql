-- =============================================================================
-- ControlObra — Script consolidado de inicializacion de BD (P0 plan 2026-10-02).
--
-- Este archivo es generado automaticamente por scripts/build-consolidated-sql.mjs
-- NO lo edites a mano. Para anadir cambios al esquema, modifica:
--   - database/mysql/init.sql (tablas base)
--   - database/mysql/migrations/NNN_<descripcion>.sql (cambios incrementales)
-- y vuelve a correr el script.
--
-- Uso en Hostinger (BD de cero):
--   1) BD: control_obra (o prefijo de Hostinger, ej u652436213_ControlObra)
--   2) phpMyAdmin -> pegar TODO este archivo -> Continuar
--
-- Pre-requisito: ninguna. Este script DROP+CREATE la BD completa.
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO,STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION";
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

DROP DATABASE IF EXISTS control_obra;
CREATE DATABASE control_obra
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE control_obra;



-- =============================================================================
-- 1) ESQUEMA BASE (init.sql)
-- =============================================================================

-- =============================================================================
CREATE TABLE users (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,
  email           VARCHAR(180)  NOT NULL UNIQUE,
  name            VARCHAR(180)  NOT NULL,
  role            ENUM('ADMIN','GERENTE','DIRECTOR','RESIDENTE','CONTABILIDAD','TESORERIA','HSEQ','CLIENTE','USER') NOT NULL,
  area            ENUM('tecnico','administrativo','ventas') NOT NULL,
  avatar_url      VARCHAR(500),
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  last_login_at   DATETIME,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_role (role),
  INDEX idx_users_area (area)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- INVITACIONES
-- =============================================================================
CREATE TABLE invitations (
  id            VARCHAR(36)   NOT NULL PRIMARY KEY,
  code          VARCHAR(20)   NOT NULL UNIQUE,
  email         VARCHAR(180)  NOT NULL,
  role          ENUM('ADMIN','GERENTE','DIRECTOR','RESIDENTE','CONTABILIDAD','TESORERIA','HSEQ','CLIENTE','USER') NOT NULL,
  area          ENUM('tecnico','administrativo','ventas'),
  project_id    VARCHAR(36),
  status        ENUM('PENDING','ACCEPTED','EXPIRED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  max_uses      INT           NOT NULL DEFAULT 1,
  uses          INT           NOT NULL DEFAULT 0,
  expires_at    DATETIME      NOT NULL,
  created_by    VARCHAR(36)   NOT NULL,
  accepted_by   VARCHAR(36),
  accepted_at   DATETIME,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_inv_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_acceptor FOREIGN KEY (accepted_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_inv_code (code),
  INDEX idx_inv_email (email),
  INDEX idx_inv_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- PROYECTOS
-- =============================================================================
CREATE TABLE projects (
  id                  VARCHAR(36)   NOT NULL PRIMARY KEY,
  code                VARCHAR(40)   NOT NULL UNIQUE,
  name                VARCHAR(255)  NOT NULL,
  client              VARCHAR(255)  NOT NULL,
  location            VARCHAR(255)  NOT NULL,
  start_date          DATE          NOT NULL,
  estimated_end_date  DATE          NOT NULL,
  total_budget        DECIMAL(15,2) NOT NULL DEFAULT 0,
  executed_amount     DECIMAL(15,2) NOT NULL DEFAULT 0,
  status              ENUM('IN_PLANNING','IN_EXECUTION','PAUSED','COMPLETED') NOT NULL DEFAULT 'IN_PLANNING',
  description         TEXT,
  created_by          VARCHAR(36),
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_proj_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_proj_code (code),
  INDEX idx_proj_status (status),
  INDEX idx_proj_dates (start_date, estimated_end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- PROVEEDORES (unifica Subcontratista + Proveedor)
-- =============================================================================
CREATE TABLE providers (
  id                VARCHAR(36)   NOT NULL PRIMARY KEY,
  person_type       ENUM('NATURAL','JURIDICA') NOT NULL,
  name              VARCHAR(255)  NOT NULL,
  nit               VARCHAR(40)   NOT NULL,
  contact           VARCHAR(180)  NOT NULL,
  email             VARCHAR(180)  NOT NULL,
  email2            VARCHAR(180),
  phone             VARCHAR(60)   NOT NULL,
  phone2            VARCHAR(60),
  website           VARCHAR(500),
  address           VARCHAR(255),
  city              VARCHAR(120),
  department        VARCHAR(120),
  postal_code       VARCHAR(30),
  category          ENUM('PRODUCTO','SERVICIO'),
  subcategory       VARCHAR(60),
  subcategory_other VARCHAR(255),
  legal_rep_name    VARCHAR(255),
  legal_rep_cedula  VARCHAR(40),
  legal_rep_email   VARCHAR(180),
  legal_rep_phone   VARCHAR(60),
  reported_income   DECIMAL(15,2),
  income_year       INT,
  status            ENUM('COMPLETE','INCOMPLETE','EXPIRED') NOT NULL DEFAULT 'INCOMPLETE',
  rating            TINYINT,
  notes             TEXT,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_providers_nit (nit),
  INDEX idx_providers_person (person_type),
  INDEX idx_providers_status (status),
  INDEX idx_providers_category (category, subcategory),
  INDEX idx_providers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Referencias comerciales del proveedor
CREATE TABLE provider_references (
  id          VARCHAR(36)   NOT NULL PRIMARY KEY,
  provider_id VARCHAR(36)   NOT NULL,
  name        VARCHAR(180)  NOT NULL,
  company     VARCHAR(180),
  phone       VARCHAR(60),
  email       VARCHAR(180),
  position    INT           NOT NULL DEFAULT 0,
  CONSTRAINT fk_prref_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
  INDEX idx_prref_provider (provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Documentos del proveedor
CREATE TABLE provider_documents (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,
  provider_id     VARCHAR(36)   NOT NULL,
  type            ENUM('CEDULA','RUT','CAMARA_COMERCIO','CERTIFICADO_BANCARIO','CERTIFICACIONES_COMERCIALES','OTROS') NOT NULL,
  file_name       VARCHAR(255)  NOT NULL,
  file_url        VARCHAR(500),
  uploaded_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expiration_date DATE,
  CONSTRAINT fk_prdoc_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
  INDEX idx_prdoc_provider (provider_id),
  INDEX idx_prdoc_type (type),
  INDEX idx_prdoc_expiration (expiration_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- CONTRATOS
-- =============================================================================
CREATE TABLE contracts (
  id                VARCHAR(36)   NOT NULL PRIMARY KEY,
  contract_number   VARCHAR(40)   NOT NULL UNIQUE,
  project_id        VARCHAR(36)   NOT NULL,
  provider_id       VARCHAR(36)   NOT NULL,
  type              ENUM('OBRA','SUMINISTRO','SERVICIOS','CONSULTORIA') NOT NULL,
  value             DECIMAL(15,2) NOT NULL,
  start_date        DATE          NOT NULL,
  end_date          DATE          NOT NULL,
  status            ENUM('DRAFT','ACTIVE','COMPLETED','CANCELLED','SUSPENDED') NOT NULL DEFAULT 'DRAFT',
  scope_of_work     TEXT          NOT NULL,
  retention_percent DECIMAL(5,2)  NOT NULL DEFAULT 0,
  advance_percent   DECIMAL(5,2)  NOT NULL DEFAULT 0,
  -- Modalidad de contratación (gap-analysis §3.3, ver 005_contract_pricing_mode.sql)
  pricing_mode      ENUM('UNIT_PRICE','LUMP_SUM','COST_PLUS') NULL,
  notes             TEXT,
  created_by        VARCHAR(36),
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_contract_project  FOREIGN KEY (project_id)  REFERENCES projects(id)  ON DELETE CASCADE,
  CONSTRAINT fk_contract_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_contract_creator  FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE SET NULL,
  INDEX idx_contract_project (project_id),
  INDEX idx_contract_provider (provider_id),
  INDEX idx_contract_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contract_documents (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,
  contract_id     VARCHAR(36)   NOT NULL,
  type            ENUM('CONTRATO_FIRMADO','POLIZA_CUMPLIMIENTO','POLIZA_RESPONSABILIDAD','POLIZA_ANTICIPO','ACTA_INICIO','OTROS') NOT NULL,
  file_name       VARCHAR(255)  NOT NULL,
  file_url        VARCHAR(500),
  uploaded_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expiration_date DATE,
  CONSTRAINT fk_cdoc_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  INDEX idx_cdoc_contract (contract_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- PRESUPUESTOS (PT)
-- =============================================================================
CREATE TABLE budgets (
  id                  VARCHAR(36)   NOT NULL PRIMARY KEY,
  project_id          VARCHAR(36)   NOT NULL UNIQUE,
  active_version_id   VARCHAR(36),
  -- Presupuesto Tope (con el que se trabaja en obra)
  total_value         DECIMAL(15,2) NOT NULL DEFAULT 0,
  -- Presupuesto Cliente (lo que aprobó el cliente)
  client_value        DECIMAL(15,2) NOT NULL DEFAULT 0,
  -- Items no previstos
  unforeseen_value    DECIMAL(15,2) NOT NULL DEFAULT 0,
  -- Condiciones comerciales (gap-analysis §3.1; ver 004_budget_commercial_terms.sql)
  payment_terms_json       TEXT       NULL,
  delivery_days            INT        NULL DEFAULT 0,
  offer_validity_days      INT        NULL DEFAULT 30,
  commercial_advisor_json  TEXT       NULL,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_budget_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_budget_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE budget_versions (
  id          VARCHAR(36)   NOT NULL PRIMARY KEY,
  budget_id   VARCHAR(36)   NOT NULL,
  version     INT           NOT NULL,
  is_active   TINYINT(1)    NOT NULL DEFAULT 0,
  total_value DECIMAL(15,2) NOT NULL,
  notes       TEXT,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bv_budget FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
  UNIQUE KEY uk_bv_budget_version (budget_id, version),
  INDEX idx_bv_active (budget_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE budgets
  ADD CONSTRAINT fk_budget_active_version
  FOREIGN KEY (active_version_id) REFERENCES budget_versions(id) ON DELETE SET NULL;

CREATE TABLE budget_layers (
  id          VARCHAR(36)   NOT NULL PRIMARY KEY,
  budget_id   VARCHAR(36)   NOT NULL,
  code        VARCHAR(20)   NOT NULL,
  name        VARCHAR(255)  NOT NULL,
  layer_type  ENUM('CHAPTER','SUBCHAPTER','ITEM') NOT NULL,
  parent_id   VARCHAR(36),
  -- Snapshot Presupuesto Cliente (lo que el cliente aprobó); NULL = usar el Tope
  is_client   TINYINT(1)    NOT NULL DEFAULT 0,
  CONSTRAINT fk_bl_budget FOREIGN KEY (budget_id)   REFERENCES budgets(id)        ON DELETE CASCADE,
  CONSTRAINT fk_bl_parent FOREIGN KEY (parent_id)    REFERENCES budget_layers(id) ON DELETE CASCADE,
  INDEX idx_bl_budget (budget_id),
  INDEX idx_bl_parent (parent_id),
  INDEX idx_bl_client  (budget_id, is_client)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE budget_items (
  id                VARCHAR(36)   NOT NULL PRIMARY KEY,
  layer_id          VARCHAR(36)   NOT NULL,
  description       VARCHAR(500)  NOT NULL,
  unit              VARCHAR(20)   NOT NULL,
  quantity          DECIMAL(15,3) NOT NULL DEFAULT 0,
  unit_price        DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_price       DECIMAL(15,2) NOT NULL DEFAULT 0,
  executed_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  executed_amount   DECIMAL(15,2) NOT NULL DEFAULT 0,
  budget_item_code  VARCHAR(40),
  CONSTRAINT fk_bi_layer FOREIGN KEY (layer_id) REFERENCES budget_layers(id) ON DELETE CASCADE,
  INDEX idx_bi_layer (layer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Items no previstos (PDF p.5)
CREATE TABLE budget_unforeseen_items (
  id           VARCHAR(36)   NOT NULL PRIMARY KEY,
  budget_id    VARCHAR(36)   NOT NULL,
  description  VARCHAR(500)  NOT NULL,
  unit         VARCHAR(20)   NOT NULL,
  quantity     DECIMAL(15,3) NOT NULL DEFAULT 0,
  unit_price   DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_price  DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_resolved  TINYINT(1)    NOT NULL DEFAULT 0,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bui_budget FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
  INDEX idx_bui_budget (budget_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- PSC — Presupuesto Proveedor (espejo del PT, antes subcontratista)
-- =============================================================================
CREATE TABLE pscs (
  id            VARCHAR(36)   NOT NULL PRIMARY KEY,
  psc_number    VARCHAR(40)   NOT NULL UNIQUE,
  project_id    VARCHAR(36)   NOT NULL,
  budget_id     VARCHAR(36)   NOT NULL,
  provider_id   VARCHAR(36)   NOT NULL,
  total_value   DECIMAL(15,2) NOT NULL DEFAULT 0,
  status        ENUM('DRAFT','ACTIVE','SUSPENDED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  notes         TEXT,
  start_date    DATE,
  end_date      DATE,
  created_by    VARCHAR(36),
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_psc_project  FOREIGN KEY (project_id)  REFERENCES projects(id)  ON DELETE CASCADE,
  CONSTRAINT fk_psc_budget   FOREIGN KEY (budget_id)   REFERENCES budgets(id)   ON DELETE CASCADE,
  CONSTRAINT fk_psc_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_psc_creator  FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE SET NULL,
  INDEX idx_psc_project (project_id),
  INDEX idx_psc_provider (provider_id),
  INDEX idx_psc_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE psc_items (
  id                  VARCHAR(36)   NOT NULL PRIMARY KEY,
  psc_id              VARCHAR(36)   NOT NULL,
  budget_item_id      VARCHAR(36)   NOT NULL,
  description         VARCHAR(500)  NOT NULL,
  unit                VARCHAR(20)   NOT NULL,
  quantity            DECIMAL(15,3) NOT NULL DEFAULT 0,
  unit_price          DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_price         DECIMAL(15,2) NOT NULL DEFAULT 0,
  executed_quantity   DECIMAL(15,3) NOT NULL DEFAULT 0,
  executed_amount     DECIMAL(15,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_psci_psc   FOREIGN KEY (psc_id)         REFERENCES pscs(id)         ON DELETE CASCADE,
  CONSTRAINT fk_psci_bitem FOREIGN KEY (budget_item_id) REFERENCES budget_items(id) ON DELETE RESTRICT,
  INDEX idx_psci_psc (psc_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- AIU — Administración, Imprevistos, Utilidad
-- =============================================================================
CREATE TABLE aiu_configs (
  id             VARCHAR(36)   NOT NULL PRIMARY KEY,
  project_id     VARCHAR(36)   NOT NULL UNIQUE,
  administration DECIMAL(5,2)  NOT NULL DEFAULT 0,
  imprevistos    DECIMAL(5,2)  NOT NULL DEFAULT 0,
  utilidad       DECIMAL(5,2)  NOT NULL DEFAULT 0,
  notes          TEXT,
  updated_by     VARCHAR(36),
  updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_aiu_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_aiu_user    FOREIGN KEY (updated_by) REFERENCES users(id)    ON DELETE SET NULL,
  INDEX idx_aiu_project (project_id),
  -- % sobre costo directo (ver migrations/008_aiu_percent_over_direct_cost.sql)
  CONSTRAINT chk_aiu_range CHECK (administration BETWEEN 0 AND 100
                              AND imprevistos    BETWEEN 0 AND 100
                              AND utilidad       BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- IMPUESTOS
-- =============================================================================
CREATE TABLE tax_configs (
  id          VARCHAR(36)   NOT NULL PRIMARY KEY,
  project_id  VARCHAR(36),
  name        VARCHAR(180)  NOT NULL,
  type        ENUM('IVA','RETENCION_FUENTE','RETENCION_IVA','RETENCION_ICA','ESTAMPILLAS','OTROS') NOT NULL,
  rate        DECIMAL(5,2)  NOT NULL,
  applies_to  ENUM('VENTAS','COMPRAS','AMBOS') NOT NULL DEFAULT 'AMBOS',
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,
  notes       TEXT,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tax_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_tax_project (project_id),
  INDEX idx_tax_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- CORTES DE OBRA
-- =============================================================================
CREATE TABLE work_cuts (
  id                VARCHAR(36)   NOT NULL PRIMARY KEY,
  cut_number        VARCHAR(40)   NOT NULL UNIQUE,
  project_id        VARCHAR(36)   NOT NULL,
  provider_id       VARCHAR(36)   NOT NULL,
  description       VARCHAR(500)  NOT NULL,
  period_start      DATE          NOT NULL,
  period_end        DATE          NOT NULL,
  gross_value       DECIMAL(15,2) NOT NULL DEFAULT 0,
  retention_percent DECIMAL(5,2)  NOT NULL DEFAULT 0,
  retention_value   DECIMAL(15,2) NOT NULL DEFAULT 0,
  advance_deduction DECIMAL(15,2) NOT NULL DEFAULT 0,
  net_value         DECIMAL(15,2) NOT NULL DEFAULT 0,
  status            ENUM('DRAFT','SUBMITTED','VALIDATED','APPROVED','REJECTED','PAID') NOT NULL DEFAULT 'DRAFT',
  submitted_at      DATETIME,
  validated_at      DATETIME,
  approved_at       DATETIME,
  paid_at           DATETIME,
  rejection_reason  TEXT,
  created_by        VARCHAR(36)   NOT NULL,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_wcut_project  FOREIGN KEY (project_id)  REFERENCES projects(id)  ON DELETE CASCADE,
  CONSTRAINT fk_wcut_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_wcut_creator  FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE RESTRICT,
  INDEX idx_wcut_project (project_id),
  INDEX idx_wcut_provider (provider_id),
  INDEX idx_wcut_status (status),
  INDEX idx_wcut_period (period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE work_cut_items (
  id                VARCHAR(36)   NOT NULL PRIMARY KEY,
  work_cut_id       VARCHAR(36)   NOT NULL,
  description       VARCHAR(500)  NOT NULL,
  unit              VARCHAR(20)   NOT NULL,
  quantity          DECIMAL(15,3) NOT NULL DEFAULT 0,
  unit_price        DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_price       DECIMAL(15,2) NOT NULL DEFAULT 0,
  budget_item_code  VARCHAR(40),
  -- PDF p.20: operación matemática + memoria
  memory_text       TEXT,
  memory_formula    VARCHAR(255),
  CONSTRAINT fk_wci_cutter FOREIGN KEY (work_cut_id) REFERENCES work_cuts(id) ON DELETE CASCADE,
  INDEX idx_wci_cutter (work_cut_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fotos de la memoria del ítem del corte
CREATE TABLE work_cut_item_photos (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,
  work_cut_item_id VARCHAR(36)  NOT NULL,
  file_name       VARCHAR(255)  NOT NULL,
  file_url        VARCHAR(500),
  caption         VARCHAR(255),
  uploaded_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wcip_item FOREIGN KEY (work_cut_item_id) REFERENCES work_cut_items(id) ON DELETE CASCADE,
  INDEX idx_wcip_item (work_cut_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE work_cut_documents (
  id           VARCHAR(36)   NOT NULL PRIMARY KEY,
  work_cut_id  VARCHAR(36)   NOT NULL,
  type         ENUM('ACTA','FACTURA','SOPORTE','OTROS') NOT NULL,
  file_name    VARCHAR(255)  NOT NULL,
  file_url     VARCHAR(500),
  uploaded_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wcd_cutter FOREIGN KEY (work_cut_id) REFERENCES work_cuts(id) ON DELETE CASCADE,
  INDEX idx_wcd_cutter (work_cut_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE work_cut_approvals (
  id         VARCHAR(36)   NOT NULL PRIMARY KEY,
  work_cut_id VARCHAR(36)  NOT NULL,
  action     ENUM('SUBMIT','VALIDATE','APPROVE','REJECT','PAY') NOT NULL,
  user_id    VARCHAR(36)   NOT NULL,
  user_name  VARCHAR(180)  NOT NULL,
  user_role  VARCHAR(40)   NOT NULL,
  comments   TEXT,
  created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wca_cutter FOREIGN KEY (work_cut_id) REFERENCES work_cuts(id) ON DELETE CASCADE,
  CONSTRAINT fk_wca_user    FOREIGN KEY (user_id)    REFERENCES users(id)     ON DELETE RESTRICT,
  INDEX idx_wca_cutter (work_cut_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- REGISTRO DE GASTOS (PDF p.7-14) — 13 tipos documentales
-- =============================================================================
CREATE TABLE expenses (
  id                     VARCHAR(36)   NOT NULL PRIMARY KEY,
  expense_number         VARCHAR(40)   NOT NULL UNIQUE,
  project_id             VARCHAR(36)   NOT NULL,
  provider_id            VARCHAR(36)   NOT NULL,
  type                   ENUM(
                           'CONTRATO_OBRA_CIVIL_POLIZAS',
                           'CONTRATO_OBRA_CIVIL_SIN_POLIZAS',
                           'PRESTACION_SERVICIOS',
                           'LABORAL_OBRA',
                           'LABORAL_TERMINO_INDEFINIDO',
                           'LABORAL_TERMINO_DEFINIDO',
                           'ORDEN_SERVICIO_POLIZAS',
                           'ORDEN_SERVICIO_SIN_POLIZAS',
                           'ORDEN_COMPRA_POLIZAS',
                           'ORDEN_COMPRA_SIN_POLIZAS',
                           'SOLICITUD_RECURSO',
                           'SOLICITUD_REINTEGRO',
                           'LEGALIZACION_GASTO'
                         ) NOT NULL,
  description            VARCHAR(500)  NOT NULL,
  amount                 DECIMAL(15,2) NOT NULL DEFAULT 0,
  date                   DATE          NOT NULL,
  status                 ENUM('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','PAID') NOT NULL DEFAULT 'DRAFT',
  advance_percent        DECIMAL(5,2),
  has_polizas            TINYINT(1),
  polizas_vigencia_desde DATE,
  polizas_vigencia_hasta DATE,
  cotizacion_aprobada    TINYINT(1),
  approved_by            VARCHAR(36),
  approved_by_name       VARCHAR(180),
  approved_at            DATETIME,
  rejected_reason        TEXT,
  created_by             VARCHAR(36),
  created_by_name        VARCHAR(180),
  created_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_exp_project  FOREIGN KEY (project_id)  REFERENCES projects(id)  ON DELETE CASCADE,
  CONSTRAINT fk_exp_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_exp_creator  FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE SET NULL,
  CONSTRAINT fk_exp_approver FOREIGN KEY (approved_by) REFERENCES users(id)     ON DELETE SET NULL,
  INDEX idx_exp_project (project_id),
  INDEX idx_exp_provider (provider_id),
  INDEX idx_exp_status (status),
  INDEX idx_exp_type (type),
  INDEX idx_exp_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE expense_items (
  id           VARCHAR(36)   NOT NULL PRIMARY KEY,
  expense_id   VARCHAR(36)   NOT NULL,
  description  VARCHAR(500)  NOT NULL,
  quantity     DECIMAL(15,3) NOT NULL DEFAULT 0,
  unit         VARCHAR(20)   NOT NULL,
  unit_price   DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_price  DECIMAL(15,2) NOT NULL DEFAULT 0,
  position     INT           NOT NULL DEFAULT 0,
  CONSTRAINT fk_expi_expense FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
  INDEX idx_expi_expense (expense_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Adjuntos de items de gasto (facturas, cuentas de cobro, recibos)
CREATE TABLE expense_item_attachments (
  id            VARCHAR(36)   NOT NULL PRIMARY KEY,
  expense_item_id VARCHAR(36) NOT NULL,
  file_name     VARCHAR(255)  NOT NULL,
  file_url      VARCHAR(500),
  uploaded_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_expia_item FOREIGN KEY (expense_item_id) REFERENCES expense_items(id) ON DELETE CASCADE,
  INDEX idx_expia_item (expense_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- BITÁCORA DIARIA DE OBRA
-- =============================================================================
CREATE TABLE work_logs (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,
  project_id      VARCHAR(36)   NOT NULL,
  date            DATE          NOT NULL,
  weather         ENUM('SOLEADO','NUBLADO','LLUVIOSO','TORMENTA','VIENTO','NIEBLA','OTRO') NOT NULL,
  temperature     DECIMAL(4,1),
  workers_count   INT           NOT NULL DEFAULT 0,
  activities      TEXT          NOT NULL,
  incidents       TEXT,
  materials       TEXT,
  observations    TEXT,
  created_by      VARCHAR(36)   NOT NULL,
  created_by_name VARCHAR(180)  NOT NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_worklog_project_date (project_id, date),
  CONSTRAINT fk_wlog_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_wlog_creator FOREIGN KEY (created_by) REFERENCES users(id)    ON DELETE RESTRICT,
  INDEX idx_wlog_project (project_id),
  INDEX idx_wlog_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE work_log_photos (
  id           VARCHAR(36)   NOT NULL PRIMARY KEY,
  work_log_id  VARCHAR(36)   NOT NULL,
  file_name    VARCHAR(255)  NOT NULL,
  file_url     VARCHAR(500),
  caption      VARCHAR(255),
  uploaded_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wlp_log FOREIGN KEY (work_log_id) REFERENCES work_logs(id) ON DELETE CASCADE,
  INDEX idx_wlp_log (work_log_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- EMPLEADOS (RRHH)
-- =============================================================================
CREATE TABLE employees (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,
  employee_number VARCHAR(40)   NOT NULL UNIQUE,
  full_name       VARCHAR(255)  NOT NULL,
  document_id     VARCHAR(40)   NOT NULL UNIQUE,
  position        VARCHAR(120)  NOT NULL,
  department      ENUM('GERENCIA','OPERACIONES','CONTABILIDAD','TESORERIA','HSEQ','COMERCIAL','ADMINISTRATIVO') NOT NULL,
  contract_type   ENUM('INDEFINIDO','FIJO','OBRA_LABOR','PRESTACION','APRENDIZAJE') NOT NULL,
  start_date      DATE          NOT NULL,
  end_date        DATE,
  salary          DECIMAL(15,2),
  eps             VARCHAR(120),
  pension_fund    VARCHAR(120),
  arl             VARCHAR(120),
  risk_level      TINYINT,
  bank_name       VARCHAR(120),
  account_type    ENUM('SAVINGS','CHECKING'),
  account_number  VARCHAR(60),
  email           VARCHAR(180),
  phone           VARCHAR(60),
  status          ENUM('ACTIVE','INACTIVE','ON_LEAVE','TERMINATED') NOT NULL DEFAULT 'ACTIVE',
  user_id         VARCHAR(36),
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_emp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_emp_doc (document_id),
  INDEX idx_emp_status (status),
  INDEX idx_emp_dept (department)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE employee_documents (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,
  employee_id     VARCHAR(36)   NOT NULL,
  type            ENUM(
                    'CEDULA',
                    'CONTRATO',
                    'AFILIACION_EPS',
                    'AFILIACION_PENSION',
                    'AFILIACION_ARL',
                    'EXAMEN_INGRESO',
                    'EXAMEN_PERIODICO',
                    'CERTIFICACION_ALTURAS',
                    'LICENCIA_CONDUCIR',
                    'CURSO_SST',
                    'OTROS'
                  ) NOT NULL,
  file_name       VARCHAR(255)  NOT NULL,
  file_url        VARCHAR(500),
  uploaded_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expiration_date DATE,
  CONSTRAINT fk_empdoc_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_empdoc_emp (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- CLIENTES (CRM)
-- =============================================================================
CREATE TABLE clients (
  id             VARCHAR(36)   NOT NULL PRIMARY KEY,
  client_number  VARCHAR(40)   NOT NULL UNIQUE,
  company_name   VARCHAR(255)  NOT NULL,
  nit            VARCHAR(40),
  contact_name   VARCHAR(180)  NOT NULL,
  email          VARCHAR(180)  NOT NULL,
  phone          VARCHAR(60)   NOT NULL,
  city           VARCHAR(120)  NOT NULL,
  sector         VARCHAR(120),
  source         ENUM('REFERIDO','WEB','REDES_SOCIALES','FERIA','LLAMADA_FRIA','OTROS') NOT NULL,
  status         ENUM('PROSPECT','CONTACTED','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST') NOT NULL DEFAULT 'PROSPECT',
  notes          TEXT,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cli_status (status),
  INDEX idx_cli_company (company_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- COTIZACIONES
-- =============================================================================
CREATE TABLE quotations (
  id                     VARCHAR(36)   NOT NULL PRIMARY KEY,
  quotation_number       VARCHAR(40)   NOT NULL UNIQUE,
  client_id              VARCHAR(36)   NOT NULL,
  title                  VARCHAR(255)  NOT NULL,
  description            TEXT,
  status                 ENUM('DRAFT','SENT','VIEWED','ACCEPTED','REJECTED','EXPIRED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  subtotal               DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_percent       DECIMAL(5,2)  NOT NULL DEFAULT 0,
  discount_amount        DECIMAL(15,2) NOT NULL DEFAULT 0,
  iva_percent            DECIMAL(5,2)  NOT NULL DEFAULT 0,
  iva_amount             DECIMAL(15,2) NOT NULL DEFAULT 0,
  total                  DECIMAL(15,2) NOT NULL DEFAULT 0,
  valid_until            DATE          NOT NULL,
  payment_terms          TEXT,
  delivery_terms         TEXT,
  warranty               TEXT,
  observations           TEXT,
  sent_at                DATETIME,
  viewed_at              DATETIME,
  responded_at           DATETIME,
  converted_to_project_id VARCHAR(36),
  created_by             VARCHAR(36),
  created_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_quot_client  FOREIGN KEY (client_id)               REFERENCES clients(id)  ON DELETE RESTRICT,
  CONSTRAINT fk_quot_project FOREIGN KEY (converted_to_project_id) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_quot_creator FOREIGN KEY (created_by)              REFERENCES users(id)     ON DELETE SET NULL,
  INDEX idx_quot_client (client_id),
  INDEX idx_quot_status (status),
  INDEX idx_quot_valid (valid_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quotation_items (
  id           VARCHAR(36)   NOT NULL PRIMARY KEY,
  quotation_id VARCHAR(36)   NOT NULL,
  description  VARCHAR(500)  NOT NULL,
  unit         VARCHAR(20)   NOT NULL,
  quantity     DECIMAL(15,3) NOT NULL DEFAULT 0,
  unit_price   DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_price  DECIMAL(15,2) NOT NULL DEFAULT 0,
  position     INT           NOT NULL DEFAULT 0,
  CONSTRAINT fk_qi_quot FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
  INDEX idx_qi_quot (quotation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- SOLICITUDES DE PAGO (Tesorería)
-- =============================================================================
CREATE TABLE payment_requests (
  id                      VARCHAR(36)   NOT NULL PRIMARY KEY,
  request_number          VARCHAR(40)   NOT NULL UNIQUE,
  project_id              VARCHAR(36)   NOT NULL,
  provider_id             VARCHAR(36),
  work_cut_id             VARCHAR(36),
  replaces_request_id     VARCHAR(36)   NULL,
  type                    ENUM('CORTE_OBRA','ANTICIPO','RETENCION','SUMINISTRO','SERVICIOS','HONORARIOS','OTROS') NOT NULL,
  amount                  DECIMAL(15,2) NOT NULL,
  priority                ENUM('LOW','NORMAL','HIGH','URGENT') NOT NULL DEFAULT 'NORMAL',
  status                  ENUM('PENDING','APPROVED_LEVEL_1','APPROVED_LEVEL_2','APPROVED','REJECTED','PAID','CANCELLED') NOT NULL DEFAULT 'PENDING',
  current_approval_level  INT           NOT NULL DEFAULT 0,
  required_approval_level INT           NOT NULL DEFAULT 1,
  beneficiary_name        VARCHAR(255)  NOT NULL,
  beneficiary_nit         VARCHAR(40)   NOT NULL,
  bank_name               VARCHAR(120)  NOT NULL,
  account_type            ENUM('SAVINGS','CHECKING') NOT NULL,
  account_number          VARCHAR(60)   NOT NULL,
  due_date                DATE,
  description             TEXT,
  paid_at                 DATETIME,
  paid_reference          VARCHAR(255),
  paid_method             ENUM('TRANSFER','CHECK','CASH'),
  rejection_reason        TEXT,
  created_by              VARCHAR(36)   NOT NULL,
  created_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pay_project  FOREIGN KEY (project_id)  REFERENCES projects(id)  ON DELETE CASCADE,
  CONSTRAINT fk_pay_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE SET NULL,
  CONSTRAINT fk_pay_cut      FOREIGN KEY (work_cut_id) REFERENCES work_cuts(id)  ON DELETE SET NULL,
  CONSTRAINT fk_pay_creator  FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE RESTRICT,
  INDEX idx_pay_project (project_id),
  INDEX idx_pay_provider (provider_id),
  INDEX idx_pay_cut (work_cut_id),
INDEX idx_pay_status (status),
    -- 016: indice + FK al padre (solo se setea si la solicitud original
    -- esta REJECTED; lo valida la aplicacion)
    INDEX idx_pay_replaces (replaces_request_id),
    CONSTRAINT fk_pay_replaces FOREIGN KEY (replaces_request_id)
      REFERENCES payment_requests(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_approvals (
  id               VARCHAR(36)   NOT NULL PRIMARY KEY,
  payment_id       VARCHAR(36)   NOT NULL,
  action           ENUM('APPROVE_L1','APPROVE_L2','PAY','REJECT','CANCEL') NOT NULL,
  level            TINYINT,
  user_id          VARCHAR(36)   NOT NULL,
  user_name        VARCHAR(180)  NOT NULL,
  user_role        VARCHAR(40)   NOT NULL,
  comments         TEXT,
  payment_reference VARCHAR(255),
  payment_method   ENUM('TRANSFER','CHECK','CASH'),
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pa_payment FOREIGN KEY (payment_id) REFERENCES payment_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_pa_user     FOREIGN KEY (user_id)    REFERENCES users(id)         ON DELETE RESTRICT,
  INDEX idx_pa_payment (payment_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- AUDITORÍA / EVENTOS (opcional, para registrar cambios sensibles)
-- =============================================================================
CREATE TABLE audit_events (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  occurred_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_id    VARCHAR(36),
  actor_name  VARCHAR(180),
  action      VARCHAR(80)   NOT NULL,
  entity_type VARCHAR(60)   NOT NULL,
  entity_id   VARCHAR(36),
  project_id  VARCHAR(36),
  metadata    JSON,
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_project (project_id),
  INDEX idx_audit_actor (actor_id),
  INDEX idx_audit_time (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- FIN — Para verificar:
--   SHOW TABLES;
--   SELECT 'Tablas creadas:', COUNT(*) FROM information_schema.tables
--     WHERE table_schema = 'control_obra';
-- =============================================================================

-- =====================================================================
-- AUTENTICACION: Codigos OTP (one-time password) para login
-- =====================================================================
CREATE TABLE IF NOT EXISTS auth_otps (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(180)  NOT NULL,
  code_hash   VARCHAR(128)  NOT NULL,
  expires_at  DATETIME      NOT NULL,
  used_at     DATETIME      NULL,
  attempts    TINYINT       NOT NULL DEFAULT 0,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_otps_email (email),
  INDEX idx_otps_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- CONTABILIDAD (migracion 003_accounting.sql)
-- =====================================================================
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


SET FOREIGN_KEY_CHECKS = 1;


-- =============================================================================
-- 2.1) Migracion 002_user_authorization.sql
-- =============================================================================

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



-- =============================================================================
-- 2.2) Migracion 003_accounting.sql
-- =============================================================================

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



-- =============================================================================
-- 2.3) Migracion 004_budget_commercial_terms.sql
-- =============================================================================

-- =============================================================================
-- Migración 004 — Condiciones comerciales en presupuestos (PT)
-- =============================================================================
-- Spec: docs/specs/gap-analysis-cliente-control-cambios.md §3.1
-- Origen: PDF cliente p.1 (Cotización Marzo Triangular — Producomex)
--
-- Persiste el bloque "Condiciones comerciales" de la cotización:
--   - Forma de pago: 50% anticipo / 40% cortes / 10% contra entrega
--   - Días de entrega desde la orden de compra
--   - Validez de la oferta en días
--   - Asesor comercial (nombre, cargo, teléfono, email)
--
-- IMPORTANTE: la migración es ADITIVA — todas las columnas son NULL/DEFAULT
-- para que los budgets existentes sigan funcionando sin tocar nada.
-- La validación de la forma de pago (suma 100) vive en
-- src/lib/budgets-validation.ts (función pura, sin BD).
-- =============================================================================


-- Idempotente: no falla si la columna ya existe (por si se re-ejecuta).
SET @col_pt := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'budgets'
    AND column_name = 'payment_terms_json'
);
SET @sql := IF(@col_pt = 0,
  'ALTER TABLE budgets ADD COLUMN payment_terms_json TEXT NULL AFTER unforeseen_value',
  'SELECT ''payment_terms_json ya existe'' AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_dd := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'budgets'
    AND column_name = 'delivery_days'
);
SET @sql := IF(@col_dd = 0,
  'ALTER TABLE budgets ADD COLUMN delivery_days INT NULL DEFAULT 0 AFTER payment_terms_json',
  'SELECT ''delivery_days ya existe'' AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_ov := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'budgets'
    AND column_name = 'offer_validity_days'
);
SET @sql := IF(@col_ov = 0,
  'ALTER TABLE budgets ADD COLUMN offer_validity_days INT NULL DEFAULT 30 AFTER delivery_days',
  'SELECT ''offer_validity_days ya existe'' AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_ca := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'budgets'
    AND column_name = 'commercial_advisor_json'
);
SET @sql := IF(@col_ca = 0,
  'ALTER TABLE budgets ADD COLUMN commercial_advisor_json TEXT NULL AFTER offer_validity_days',
  'SELECT ''commercial_advisor_json ya existe'' AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill defensivo: budgets viejos quedan con NULLs y defaults razonables.
UPDATE budgets
SET delivery_days = COALESCE(delivery_days, 0),
    offer_validity_days = COALESCE(offer_validity_days, 30)
WHERE delivery_days IS NULL OR offer_validity_days IS NULL;



-- =============================================================================
-- 2.4) Migracion 005_contract_pricing_mode.sql
-- =============================================================================

-- =============================================================================
-- Migración 005 — Modalidad de contratación en contratos
-- =============================================================================
-- Spec: docs/specs/gap-analysis-cliente-control-cambios.md §3.3
-- Origen: PDF cliente p.5 (Contrato 0000025-0703 "Valor Unitario Fijo /
-- OBRA CIVIL TODO COSTO")
--
-- Añade la columna `pricing_mode` a `contracts` con la unión
-- ENUM('UNIT_PRICE','LUMP_SUM','COST_PLUS'). Es NULL y sin default para
-- no asumir nada sobre contratos existentes: el código en
-- src/lib/contracts-constants.ts (normalizePricingMode / validatePricingMode)
-- rellena UNIT_PRICE cuando el campo viene null.
-- =============================================================================


-- Idempotente.
SET @col := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'contracts'
    AND column_name = 'pricing_mode'
);
SET @sql := IF(@col = 0,
  "ALTER TABLE contracts
     ADD COLUMN pricing_mode
     ENUM('UNIT_PRICE','LUMP_SUM','COST_PLUS') NULL
     AFTER advance_percent",
  "SELECT 'pricing_mode ya existe' AS msg");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill opcional: contratos OBRA sin modalidad definida heredan UNIT_PRICE
-- (que es el caso por defecto del PDF del cliente). Si más adelante se prefiere
-- dejar NULL para revisarlos, basta con no correr este UPDATE.
UPDATE contracts
SET pricing_mode = 'UNIT_PRICE'
WHERE pricing_mode IS NULL AND type = 'OBRA';



-- =============================================================================
-- 2.5) Migracion 006_document_generation.sql
-- =============================================================================

-- 006_document_generation.sql
-- Migración idempotente. Agrega:
--   1) Tabla document_generation_log (registro de cada generación+upload).
--   2) Columna generated_document_url en las 6 entidades que producen
--      documentos, para persistir el último webUrl devuelto por SharePoint.
--
-- Ver docs/specs/document-generation-sharepoint.md §4.5.
--
-- NOTA: MySQL 8.0 (al menos 8.0.46) NO soporta `ADD COLUMN IF NOT EXISTS`
-- en ALTER TABLE. Por eso la columna se agrega desde el script
-- `scripts/apply-migration.mjs`, que primero consulta information_schema
-- y luego hace el ALTER solo si la columna no existe. Esta migración SQL
-- solo crea la tabla de log, que sí soporta `CREATE TABLE IF NOT EXISTS`.

-- 1) Tabla de log ------------------------------------------------------
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
  INDEX idx_entity        (entity, entity_id),
  INDEX idx_created       (created_at),
  INDEX idx_status        (status),
  INDEX idx_template      (template_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Columnas generated_document_url en entidades ----------------------
-- Se aplican desde el script con un information_schema guard:
--   ALTER TABLE <t> ADD COLUMN generated_document_url TEXT NULL
-- sólo si information_schema.COLUMNS no la tiene.



-- =============================================================================
-- 2.6) Migracion 007_document_generation_audit.sql
-- =============================================================================

-- 007_document_generation_audit.sql
-- Migración idempotente. Extiende document_generation_log con campos
-- de auditoría de seguridad (F4):
--   - ip:              IP del cliente que disparó la generación
--   - user_agent:      User-Agent del cliente
--   - attempts:        número de intentos que hizo la subida (post-retry)
--   - template_version: versión del template (V1, V2, 3.2, [1], etc.)
--
-- Cada ALTER usa information_schema guard porque MySQL 8.0.46 NO soporta
-- ADD COLUMN IF NOT EXISTS. El script apply-migration.mjs detecta y aplica
-- los ALTER solo si la columna no existe.

-- 1) ALTER con information_schema guard (lo aplica apply-migration.mjs):
--   ALTER TABLE document_generation_log
--     ADD COLUMN ip VARCHAR(64) NULL AFTER user_id,
--     ADD COLUMN user_agent VARCHAR(255) NULL AFTER ip,
--     ADD COLUMN attempts TINYINT UNSIGNED NULL AFTER user_agent,
--     ADD COLUMN template_version VARCHAR(16) NULL AFTER attempts;
--
-- (Idempotente: si las columnas ya existen, no se vuelve a aplicar.)



-- =============================================================================
-- 2.7) Migracion 008_aiu_percent_over_direct_cost.sql
-- =============================================================================

-- =============================================================================
-- Migración 008 — AIU como % sobre costo directo
-- =============================================================================
-- Spec: docs/specs/bug-aiu-porcentaje-sobre-costo-directo.md
--
-- La regla vieja chk_aiu_sum exigía A + I + U = 100, lo que impedía guardar el
-- AIU real del cliente (8 % + 5 % + 5 % sobre costo directo). Se reemplaza por
-- un rango 0–100 por componente. La regla "AIU total <= 100 %" vive en
-- src/lib/aiu-constants.ts (validateAiu).
--
-- Requiere MySQL >= 8.0.16 (soporte de CHECK). Idempotente.
-- =============================================================================


SET @has_old := (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE table_schema = DATABASE() AND table_name = 'aiu_configs'
    AND constraint_name = 'chk_aiu_sum'
);
SET @sql := IF(@has_old > 0,
  "ALTER TABLE aiu_configs DROP CHECK chk_aiu_sum",
  "SELECT 'chk_aiu_sum ya no existe' AS msg");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_new := (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE table_schema = DATABASE() AND table_name = 'aiu_configs'
    AND constraint_name = 'chk_aiu_range'
);
SET @sql := IF(@has_new = 0,
  "ALTER TABLE aiu_configs ADD CONSTRAINT chk_aiu_range CHECK (
     administration BETWEEN 0 AND 100
     AND imprevistos BETWEEN 0 AND 100
     AND utilidad    BETWEEN 0 AND 100)",
  "SELECT 'chk_aiu_range ya existe' AS msg");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Revisión manual: configuraciones hechas con la regla vieja (suman ~100 %)
-- que ahora representarían un AIU desproporcionado.
SELECT project_id, administration, imprevistos, utilidad,
       administration + imprevistos + utilidad AS aiu_total
  FROM aiu_configs
 WHERE administration + imprevistos + utilidad > 40;



-- =============================================================================
-- 2.8) Migracion 009_budget_change_orders.sql
-- =============================================================================

-- =============================================================================
-- Migración 009 — Control de Cambios del presupuesto (CC-001, CC-002…)
-- =============================================================================
-- Spec: docs/specs/budget-change-control.md
-- Origen: PDF cliente pág. 2–3 ("COTIZACIÓN CONTROL DE CAMBIOS 001").
--
-- - budgets.change_order_seq: contador para numerar CC sin reutilizar números
--   aunque un CC se elimine.
-- - budget_change_orders: cabecera + AIU congelado + totales calculados en el
--   servidor (lib/budget-change-control.ts).
-- - budget_change_order_items: ítems propios del CC (unit_price < 0 = deducción).
--
-- No modifica datos existentes. Idempotente.
-- =============================================================================


SET @col := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'budgets'
    AND column_name = 'change_order_seq'
);
SET @sql := IF(@col = 0,
  "ALTER TABLE budgets ADD COLUMN change_order_seq INT NOT NULL DEFAULT 0",
  "SELECT 'change_order_seq ya existe' AS msg");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS budget_change_orders (
  id                     VARCHAR(36)   NOT NULL PRIMARY KEY,
  budget_id              VARCHAR(36)   NOT NULL,
  seq                    INT           NOT NULL,
  number                 VARCHAR(12)   NOT NULL,              -- "CC-001"
  issue_date             DATE          NOT NULL,
  request_channel        ENUM('ACTA_COMITE','MAIL','SOLICITUD_VERBAL','OTROS') NOT NULL,
  request_channel_other  VARCHAR(255)  NULL,
  description            TEXT          NOT NULL,
  advisor_name           VARCHAR(255)  NULL,
  -- AIU congelado al crear el CC (% sobre costo directo)
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
  CONSTRAINT fk_bco_budget  FOREIGN KEY (budget_id)            REFERENCES budgets(id)         ON DELETE CASCADE,
  CONSTRAINT fk_bco_version FOREIGN KEY (resulting_version_id) REFERENCES budget_versions(id) ON DELETE SET NULL,
  CONSTRAINT fk_bco_creator FOREIGN KEY (created_by)           REFERENCES users(id)           ON DELETE SET NULL,
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
  unit_price       DECIMAL(15,2) NOT NULL DEFAULT 0,      -- negativo = deducción
  total_price      DECIMAL(15,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_bcoi_co FOREIGN KEY (change_order_id) REFERENCES budget_change_orders(id) ON DELETE CASCADE,
  INDEX idx_bcoi_co (change_order_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- =============================================================================
-- 2.9) Migracion 010_soft_delete_projects.sql
-- =============================================================================

-- =============================================================================
-- Migracion 010: soft delete en `projects` + proteccion de auditoria
-- financiera.
--
-- P0 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.2):
--   Borrar un proyecto borraba en cascada sus cortes, pagos (incluso los
--   PAID) y aprobaciones, destruyendo la auditoria financiera. Esta
--   migracion:
--     1) agrega `deleted_at` y `deleted_by` a `projects` para soft delete;
--     2) cambia el handler DELETE para hacer UPDATE de `deleted_at` en vez
--        de DELETE fisico;
--     3) cambia las FK que apuntaban en CASCADE contra `projects(id)` a
--        RESTRICT, de modo que la BD misma impida borrar un proyecto con
--        pagos/cortes aprobados mientras el handler no haga soft delete.
--
-- Las FK que estaban en SET NULL (provider_id, work_cut_id en
-- payment_requests; created_by en project_references) no se tocan: ya son
-- seguras. Solo cambiamos las que estaban en CASCADE.
--
-- Idempotente: usa ALTER ... DROP/ADD para re-ejecucion segura en entornos
-- de desarrollo. En produccion aplicar una sola vez.
-- =============================================================================

-- 1) Columnas de soft delete en projects -------------------------------------
SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'projects'
    AND column_name = 'deleted_at'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE projects ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL AFTER updated_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'projects'
    AND column_name = 'deleted_by'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE projects ADD COLUMN deleted_by VARCHAR(36) NULL DEFAULT NULL AFTER deleted_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Indice para que los listados filtren rapido los no borrados.
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'projects'
    AND index_name = 'idx_proj_deleted_at'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_proj_deleted_at ON projects (deleted_at)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) FK work_cuts.project_id: CASCADE -> RESTRICT ----------------------------
--    Antes: borrar un proyecto arrastraba todos los cortes (y los items,
--    aprobaciones y documentos ligados a ellos). Ahora la BD rechaza el
--    DELETE fisico de un proyecto con cortes; el handler hace soft delete.
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'work_cuts'
    AND constraint_name = 'fk_wcut_project'
);
SET @sql := IF(@fk_exists = 1,
  'ALTER TABLE work_cuts DROP FOREIGN KEY fk_wcut_project',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'work_cuts'
    AND constraint_name = 'fk_wcut_project'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE work_cuts ADD CONSTRAINT fk_wcut_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) FK payment_requests.project_id: CASCADE -> RESTRICT ---------------------
--    Antes: borrar un proyecto borraba los pagos PAID y su historial de
--    aprobaciones. Ahora la BD lo impide; el handler usa soft delete.
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'payment_requests'
    AND constraint_name = 'fk_pay_project'
);
SET @sql := IF(@fk_exists = 1,
  'ALTER TABLE payment_requests DROP FOREIGN KEY fk_pay_project',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'payment_requests'
    AND constraint_name = 'fk_pay_project'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE payment_requests ADD CONSTRAINT fk_pay_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;



-- =============================================================================
-- 2.10) Migracion 011_audit_and_soft_delete.sql
-- =============================================================================

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



-- =============================================================================
-- 2.11) Migracion 012_beneficiary_accounts.sql
-- =============================================================================

-- =============================================================================
-- Migracion 012: tabla beneficiary_accounts (P1, docs seccion 4.2)
--
-- Por que existe: payment_requests.account_number esta en claro y ademas
-- se desnormaliza (cada solicitud copia banco, tipo y numero del
-- beneficiario). Aqui centralizamos la cuenta por proveedor:
--   - provider_id referencia a providers
--   - bank_name, account_type, account_number cifrado (columna
--     account_number_cipher para guardar el resultado de
--     lib/crypto.encryptColumn)
--   - is_default marca la cuenta principal del proveedor
--   - deleted_at + deleted_by para soft delete coherente con 010/011
--
-- Cambios minimos en payment_requests para no romper compatibilidad:
--   - Agregamos beneficiary_account_id (NULL permitido) para que las
--     rutas migren gradualmente. La columna account_number se conserva
--     como texto plano para no romper GET existentes; las migraciones
--     futuras haran el backfill y podran nulificarla.
-- =============================================================================

CREATE TABLE IF NOT EXISTS beneficiary_accounts (
  id                    VARCHAR(36)   NOT NULL PRIMARY KEY,
  provider_id           VARCHAR(36)   NOT NULL,
  bank_name             VARCHAR(120)  NOT NULL,
  account_type          ENUM('SAVINGS','CHECKING') NOT NULL,
  account_number_cipher TEXT          NOT NULL,
  account_number_last4  CHAR(4)       NOT NULL,
  is_default            TINYINT(1)    NOT NULL DEFAULT 0,
  created_by            VARCHAR(36),
  created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by            VARCHAR(36),
  updated_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at            DATETIME      NULL DEFAULT NULL,
  deleted_by            VARCHAR(36),
  CONSTRAINT fk_bacc_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_bacc_creator  FOREIGN KEY (created_by)  REFERENCES users(id)    ON DELETE SET NULL,
  INDEX idx_bacc_provider (provider_id, is_default),
  INDEX idx_bacc_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- payment_requests.beneficiary_account_id (NULL permitido en transicion)
SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'payment_requests'
               AND column_name = 'beneficiary_account_id');
SET @sql := IF(@col = 0,
  'ALTER TABLE payment_requests ADD COLUMN beneficiary_account_id VARCHAR(36) NULL DEFAULT NULL AFTER account_number',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
             WHERE table_schema = DATABASE() AND table_name = 'payment_requests'
               AND index_name = 'idx_pay_beneficiary_account');
SET @sql := IF(@idx = 0,
  'CREATE INDEX idx_pay_beneficiary_account ON payment_requests (beneficiary_account_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.table_constraints
            WHERE constraint_schema = DATABASE()
              AND table_name = 'payment_requests'
              AND constraint_name = 'fk_pay_beneficiary_account');
SET @sql := IF(@fk = 0,
  'ALTER TABLE payment_requests ADD CONSTRAINT fk_pay_beneficiary_account FOREIGN KEY (beneficiary_account_id) REFERENCES beneficiary_accounts(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;



-- =============================================================================
-- 2.12) Migracion 013_client_stage_history.sql
-- =============================================================================

-- =============================================================================
-- Migracion 013: client_stage_history
--
-- P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.2 + 4.1):
--   Hoy la guia dice "solo se puede avanzar" en el pipeline, pero el
--   servidor acepta cualquier cambio de status en clients.status y no
--   queda registro de las transiciones. Esta tabla guarda cada
--   movimiento (incluyendo LOST con motivo) para que el historial del
--   cliente sea auditable.
-- =============================================================================

CREATE TABLE IF NOT EXISTS client_stage_history (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  client_id       VARCHAR(36)  NOT NULL,
  from_status     ENUM('PROSPECT','CONTACTED','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST') NULL,
  to_status       ENUM('PROSPECT','CONTACTED','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST') NOT NULL,
  reason          TEXT,
  changed_by      VARCHAR(36),
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_csh_client  FOREIGN KEY (client_id)  REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_csh_changed FOREIGN KEY (changed_by) REFERENCES users(id)   ON DELETE SET NULL,
  INDEX idx_csh_client (client_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- =============================================================================
-- 2.13) Migracion 014_counters.sql
-- =============================================================================

-- =============================================================================
-- Migracion 014: tabla counters (P2, docs seccion 4.1)
--
-- Por que existe: los consecutivos PAG-, CO-, CLI-, COT- se generan
-- con `Date.now().toString(36)` recortado, lo que puede colisionar
-- y no es secuencial. Aqui centralizamos la numeracion:
--   - (entity, year) UNIQUE
--   - last_number autoincrementa
--   - prefijo permite formatear a la primera
--
-- El helper `nextSequence()` (lib/counters.ts) hace INSERT ... ON
-- DUPLICATE KEY UPDATE last_number = last_number + 1 dentro de una
-- transaccion, y devuelve el nuevo numero formateado.
-- =============================================================================

CREATE TABLE IF NOT EXISTS counters (
  entity      VARCHAR(40)  NOT NULL,
  year        INT          NOT NULL,
  prefix      VARCHAR(10)  NOT NULL,
  last_number INT          NOT NULL DEFAULT 0,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (entity, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- =============================================================================
-- 2.14) Migracion 015_user_sessions.sql
-- =============================================================================

-- =============================================================================
-- Migracion 015: user_sessions (sesion revocable)
--
-- P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.4):
--   Hoy la cookie `co_session` solo firma el userId (HMAC). Una cookie
--   robada sirve hasta que se cambie la SESSION_SECRET. Ademas el
--   logout solo borra la cookie del navegador, no invalida la sesion
--   en el servidor. Con esta tabla:
--     1. La cookie firma userId|exp y se rechaza si exp < now.
--     2. Cada sesion activa tiene una fila aqui; el servidor la
--        consulta y devuelve 401 si esta revocada.
--     3. Logout = marcar revoked_at = NOW().
--     4. Suspensión de usuario = revocar TODAS sus sesiones.
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  user_id         VARCHAR(36)  NOT NULL,
  -- token_id: subfijo random presente en la cookie. Asi el servidor
  -- puede revocar UNA sesion sin invalidar todas las del usuario.
  token_id        VARCHAR(64)  NOT NULL UNIQUE,
  expires_at      DATETIME     NOT NULL,
  revoked_at      DATETIME     NULL,
  revoked_reason  VARCHAR(255) NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip              VARCHAR(45)  NULL,
  user_agent      VARCHAR(255) NULL,
  CONSTRAINT fk_us_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_us_user (user_id, expires_at),
  INDEX idx_us_token (token_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- =============================================================================
-- 2.15) Migracion 016_payment_replaces_request_id.sql
-- =============================================================================

-- =============================================================================
-- Migracion 016: payment_requests.replaces_request_id (P2 plan 2026-10-01)
--
-- Por que existe: cuando se rechaza una solicitud de pago (status =
-- REJECTED), los usuarios suelen querer corregir el monto, el
-- beneficiario o el corte de trabajo y crear una nueva solicitud que
-- la "reemplaza". Hasta ahora no existia forma de vincular ambas
-- solicitudes, asi que el historial quedaba cortado y era imposible
-- responder "esta solicitud reemplazo a tal otra".
--
-- Esta columna guarda el id de la solicitud rechazada original. Solo
-- se permite si el id referenciado esta en status = REJECTED; la
-- validacion se hace en la aplicacion (lib/payments-workflow.ts y
-- la ruta POST /api/payments), porque MySQL no permite CHECKs
-- condicionales contra otra fila de forma nativa.
--
-- La columna es NULL por defecto (las solicitudes originales siguen
-- funcionando sin tocar nada).
-- =============================================================================

SET @col_exists := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'payment_requests'
     AND COLUMN_NAME  = 'replaces_request_id'
);

SET @sql := IF(@col_exists = 0,
  'ALTER TABLE payment_requests
     ADD COLUMN replaces_request_id VARCHAR(36) NULL AFTER work_cut_id,
     ADD CONSTRAINT fk_pay_replaces
       FOREIGN KEY (replaces_request_id) REFERENCES payment_requests(id)
       ON DELETE SET NULL,
     ADD INDEX idx_pay_replaces (replaces_request_id)',
  'SELECT "016: replaces_request_id ya existe, skip" AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;



-- =============================================================================
-- 2.16) Migracion 017_accounting_articulacion.sql
-- =============================================================================

-- =============================================================================
-- Migracion 017: Articulacion modulo Contabilidad (Fase 1 + 2)
--
-- Por que existe, cuando existe: P0 plan 2026-10-02. El modulo
-- /api/accounting/ existia pero estaba DESARTICULADO del resto del sistema.
-- Un pago en /api/payments que pasaba a PAID, un corte APPROVED, o un
-- gasto PAGADO NO generaba ningun movimiento contable. Esto hacia que el
-- panel contable quedara vacio aun cuando la empresa llevaba operando
-- semanas.
--
-- Esta migracion agrega tres columnas para permitir la auto-creacion
-- de asientos (Fase 1) y mejores validaciones (Fase 2):
--
--   1) payment_requests.account_id
--      -> La cuenta bancaria donde Tesoreria realizo la transferencia
--         al marcar la solicitud como PAID. Requerido por el helper
--         accounting_expenses con status PAGADO. La UI pedira este campo
--         en la accion PAY (antes era solo paymentReference + paymentMethod).
--
--   2) accounting_tax_movements.tax_type
--      -> FK a tax_configs.type. Antes 0 lo habilitamos: solo existia
--         `description` libre, lo que impedia filtrar "total IVA del
--         ano" sin texto. Ahora se puede reportar por tipo (IVA,
--         RETENCION_FUENTE, RETENCION_IVA, RETENCION_ICA, ESTAMPILLAS,
--         OTROS). Nullable para mantener compatibilidad.
--
--   3) accounting_expenses.expense_source_id y expense_source_type
--      -> Vincula el gasto contable con su origen real (payment_request.id
--         o expense.id o work_cut.id). Permite navegar del panel
--         contable al documento de obra que lo origino. Idempotente:
--         si ya existe el asiento para ese origen, no se duplica.
--         Indice UNIQUE por (source_type, source_id) para garantizarlo.
--
-- Compatibilidad: 100% aditiva. Las columnas son NULL por defecto.
-- No se rompen pagos/gastos/§-movimientos pre-existentes.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1) payment_requests.account_id
-- -----------------------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'payment_requests'
     AND COLUMN_NAME  = 'account_id'
);

SET @sql := IF(@col_exists = 0,
  'ALTER TABLE payment_requests
     ADD COLUMN account_id VARCHAR(36) NULL AFTER paid_method,
     ADD CONSTRAINT fk_pay_account
       FOREIGN KEY (account_id) REFERENCES accounting_accounts(id)
       ON DELETE RESTRICT,
     ADD INDEX idx_pay_account (account_id)',
  'SELECT "017: payment_requests.account_id ya existe, skip" AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- 2) accounting_tax_movements.tax_type
-- -----------------------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'accounting_tax_movements'
     AND COLUMN_NAME  = 'tax_type'
);

SET @sql := IF(@col_exists = 0,
  'ALTER TABLE accounting_tax_movements
     ADD COLUMN tax_type ENUM(''IVA'',''RETENCION_FUENTE'',''RETENCION_IVA'',''RETENCION_ICA'',''ESTAMPILLAS'',''OTROS'')
                                 NULL AFTER description,
     ADD INDEX idx_acc_tax_type (tax_type)',
  'SELECT "017: accounting_tax_movements.tax_type ya existe, skip" AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- 3) accounting_expenses.expense_source_type + expense_source_id
--    + UNIQUE(source_type, source_id) para idempotencia
-- -----------------------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'accounting_expenses'
     AND COLUMN_NAME  = 'expense_source_type'
);

SET @sql := IF(@col_exists = 0,
  'ALTER TABLE accounting_expenses
     ADD COLUMN expense_source_type ENUM(''PAYMENT_REQUEST'',''EXPENSE'',''WORK_CUT'')
                                       NULL AFTER account_id,
     ADD COLUMN expense_source_id   VARCHAR(36) NULL AFTER expense_source_type,
     ADD UNIQUE KEY uq_acc_expense_source (expense_source_type, expense_source_id),
     ADD INDEX idx_acc_expense_source_type (expense_source_type)',
  'SELECT "017: accounting_expenses.expense_source_* ya existe, skip" AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- Verificacion
-- -----------------------------------------------------------------------------
-- Esperado:
--   payment_requests.account_id              VARCHAR(36) NULL
--   accounting_tax_movements.tax_type        ENUM(...) NULL
--   accounting_expenses.expense_source_type  ENUM(...) NULL
--   accounting_expenses.expense_source_id    VARCHAR(36) NULL
--   UNIQUE KEY uq_acc_expense_source (expense_source_type, expense_source_id)
--
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = DATABASE()
--    AND ((table_name = 'payment_requests' AND column_name = 'account_id')
--     OR (table_name = 'accounting_tax_movements' AND column_name = 'tax_type')
--     OR (table_name = 'accounting_expenses' AND column_name IN ('expense_source_type','expense_source_id')))
--  ORDER BY table_name, column_name;


SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- 3) USUARIOS INICIALES (P0 plan 2026-10-02, Fase 4.2)
-- Solo ADMIN y GERENTE. El resto se crea desde /administrativo/usuarios.
-- Tras primer login el sistema solicita OTP por email (auth/request-otp).
-- =============================================================================

-- ADMIN: Nelson Rozo <nelson@controlobra.local>
-- GERENTE: queda como placeholder. Crear con el primer login real.
INSERT INTO users (id, email, name, role, area, status, is_active, created_at, updated_at)
VALUES
  (UUID(), 'nelson@controlobra.local', 'Nelson Rozo', 'ADMIN', 'administrativo', 'ACTIVE', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE role = 'ADMIN', is_active = 1, updated_at = NOW();


-- =============================================================================
-- Fin del consolidado. BD lista para arrancar ControlObra.
-- Tablas creadas, indices OK, FK activas. Solo usuarios ADMIN/GERENTE.
-- =============================================================================
