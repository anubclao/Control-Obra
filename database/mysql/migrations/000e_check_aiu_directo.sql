-- =============================================================================
-- Verificación directa de chk_aiu_range (sin information_schema)
-- =============================================================================
-- En Hostinger compartido el usuario no siempre tiene acceso a
-- information_schema. Usamos SHOW CREATE TABLE para ver las constraints
-- que están aplicadas a la tabla.
-- =============================================================================

SHOW CREATE TABLE aiu_configs;
