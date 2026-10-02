-- =============================================================================
-- 000g — AIU combo final (maneja los 3 casos: ya está, quedó la vieja, falta)
-- =============================================================================
-- No usa information_schema. En su lugar hace DROP condicional con manejo
-- de errores: si la constraint no existe, MariaDB tira 1091 y phpMyAdmin
-- continúa con el siguiente statement.
--
-- ORDEN:
--   1) DROP chk_aiu_sum      (ignora error 1091 si no existe)
--   2) DROP chk_aiu_range    (ignora error 1091 si no existe)
--   3) ADD  chk_aiu_range    (ignora error 1826 si ya existe bien)
--   4) Verificar con SHOW CREATE TABLE
-- =============================================================================

-- 1) DROP de la vieja (puede fallar con 1091 si no existe — está OK)
ALTER TABLE aiu_configs DROP CONSTRAINT chk_aiu_sum;

-- 2) DROP de la nueva (por si quedó mal formada — también puede fallar con 1091)
ALTER TABLE aiu_configs DROP CONSTRAINT chk_aiu_range;

-- 3) Crear la buena. Si por algún motivo ya existe bien, fallará con 1826
--    y phpMyAdmin seguirá con el SHOW CREATE TABLE de abajo.
ALTER TABLE aiu_configs
  ADD CONSTRAINT chk_aiu_range CHECK (
    administration BETWEEN 0 AND 100
    AND imprevistos BETWEEN 0 AND 100
    AND utilidad    BETWEEN 0 AND 100
  );

-- 4) Verificación final
SHOW CREATE TABLE aiu_configs\G
