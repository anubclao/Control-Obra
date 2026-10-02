-- =============================================================================
-- 999 — Recuperación de emergencia: aiu_configs
-- =============================================================================
-- USAR SOLO SI la tabla aiu_configs quedó dañada o no existe.
-- Recrea la tabla con la estructura correcta y la constraint nueva.
-- Los datos viejos de AIU se pierden (solo eran los % por proyecto).
-- Después de correr esto, re-configurar el AIU de cada proyecto desde la UI.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aiu_configs (
  id             VARCHAR(36)   NOT NULL PRIMARY KEY,
  project_id     VARCHAR(36)   NOT NULL UNIQUE,
  administration DECIMAL(5,2)  NOT NULL DEFAULT 0,
  imprevistos    DECIMAL(5,2)  NOT NULL DEFAULT 0,
  utilidad       DECIMAL(5,2)  NOT NULL DEFAULT 0,
  notes          TEXT,
  updated_by     VARCHAR(36),
  updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_aiu_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- La constraint chk_aiu_range (separada para no abortar si ya existe)
SET @has_constraint := (
  SELECT COUNT(*) FROM information_schema.table_constraints
   WHERE table_schema = DATABASE() AND table_name = 'aiu_configs'
     AND constraint_name = 'chk_aiu_range'
);

-- (Si information_schema no está disponible, este SELECT puede fallar;
--  en ese caso, intentar el ALTER directamente y capturar el error 1826.)
SET @sql := IF(@has_constraint = 0,
  'ALTER TABLE aiu_configs ADD CONSTRAINT chk_aiu_range CHECK (administration BETWEEN 0 AND 100 AND imprevistos BETWEEN 0 AND 100 AND utilidad BETWEEN 0 AND 100)',
  'SELECT "chk_aiu_range ya existe" AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SHOW CREATE TABLE aiu_configs;
