-- =============================================================================
-- Control de Obra Pro - Esquema MySQL/MariaDB inicial
-- =============================================================================
-- Versión objetivo: MySQL 8.0+ / MariaDB 10.5+
-- Charset: utf8mb4 (soporte completo de caracteres + emojis)
-- IDs: VARCHAR(36) — UUID v4 generado en app
-- Motor: InnoDB (FK, transacciones, integridad)
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
-- USUARIOS DEL SISTEMA
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
  INDEX idx_pay_status (status)
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
