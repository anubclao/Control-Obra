-- =============================================================================
-- ControlObra — Asegurar chk_aiu_range en aiu_configs (idempotente)
-- =============================================================================
-- Situación: la tabla aiu_configs ya existe (porque vos o un intento previo
-- la restauró), pero la constraint chk_aiu_range no se creó.
-- Este script:
--   1) Verifica si la constraint existe (information_schema)
--   2) Si existe, no hace nada
--   3) Si no existe, intenta crearla con ALTER TABLE ... ADD CONSTRAINT
--   4) Reporta el resultado
-- =============================================================================

-- 1) Ver estado actual de constraints en aiu_configs
SELECT constraint_name, constraint_type
  FROM information_schema.table_constraints
 WHERE table_schema = DATABASE()
   AND table_name   = 'aiu_configs'
 ORDER BY constraint_name;

-- 2) Intentar agregar chk_aiu_range (si ya existe, da error 1826 que NO
-- detiene la sesión; si no existe, la crea)
ALTER TABLE aiu_configs
  ADD CONSTRAINT chk_aiu_range CHECK (
    administration BETWEEN 0 AND 100
    AND imprevistos BETWEEN 0 AND 100
    AND utilidad    BETWEEN 0 AND 100
  );

-- 3) Verificación final: chk_aiu_range debe aparecer
SELECT
  (SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE()
      AND table_name   = 'aiu_configs'
      AND constraint_name = 'chk_aiu_range') AS chk_aiu_range_count,
  (SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE()
      AND table_name   = 'aiu_configs'
      AND constraint_name = 'chk_aiu_sum') AS chk_aiu_sum_vieja_count,
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name   = 'aiu_configs'
      AND column_name  = 'project_id') AS tiene_project_id;
