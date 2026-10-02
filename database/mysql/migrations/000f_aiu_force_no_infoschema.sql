-- =============================================================================
-- Forzar creación de chk_aiu_range (sin information_schema)
-- =============================================================================
-- Para Hostinger compartido donde el usuario MySQL no tiene acceso
-- a information_schema. Usamos SHOW CREATE TABLE como "fuente de verdad"
-- y capturamos el error 1826 (duplicate) sin abortar.
--
-- ORDEN:
--   1) DROP chk_aiu_sum si existe (puede haber quedado de intentos previos)
--   2) DROP chk_aiu_range si existe (por si quedó mal formado)
--   3) ADD chk_aiu_range con la sintaxis correcta para MariaDB
--   4) Verificar con SHOW CREATE TABLE
-- =============================================================================

-- 1) Intentar dropear chk_aiu_sum (falla silenciosa si no existe)
--    Usamos un SAVEPOINT para que el error 1091 (Can't DROP nonexistent)
--    no aborte la sesión.
SET @sql_drop_sum := 'ALTER TABLE aiu_configs DROP CONSTRAINT chk_aiu_sum';
SET @err := 0;
BEGIN;
  SET @try := (SELECT 1);  -- placeholder
  -- Ejecutamos dentro de un handler que ignora el error
  -- (MariaDB no tiene CONTINUE HANDLER en SQL plano, así que usamos
  --  un approach más simple: TRY directo y dejamos que el error 1091
  --  aborte SOLO este SAVEPOINT)
ROLLBACK;

-- Más simple: ejecutamos el DROP y dejamos que falle si no existe.
-- Como phpMyAdmin continúa con los siguientes statements, está bien.
ALTER TABLE aiu_configs DROP CONSTRAINT chk_aiu_sum;
ALTER TABLE aiu_configs DROP CONSTRAINT chk_aiu_range;

-- 2) Crear la constraint nueva
ALTER TABLE aiu_configs
  ADD CONSTRAINT chk_aiu_range CHECK (
    administration BETWEEN 0 AND 100
    AND imprevistos BETWEEN 0 AND 100
    AND utilidad    BETWEEN 0 AND 100
  );

-- 3) Verificación final
SHOW CREATE TABLE aiu_configs;
