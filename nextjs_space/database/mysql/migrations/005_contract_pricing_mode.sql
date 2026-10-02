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

USE control_obra;

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
