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

USE control_obra;

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
