-- =============================================================================
-- 000h — Solo agregar chk_aiu_range (asumiendo que chk_aiu_sum ya no existe)
-- =============================================================================
-- phpMyAdmin aborta en el primer error, así que no podemos hacer DROP+ADD
-- en el mismo script. Este es solo el ADD, que es lo único que falta.
-- =============================================================================

ALTER TABLE aiu_configs
  ADD CONSTRAINT chk_aiu_range CHECK (
    administration BETWEEN 0 AND 100
    AND imprevistos BETWEEN 0 AND 100
    AND utilidad    BETWEEN 0 AND 100
  );

SHOW CREATE TABLE aiu_configs\G
