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

USE control_obra;

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
