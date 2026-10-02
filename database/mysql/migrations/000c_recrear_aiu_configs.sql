-- =============================================================================
-- ControlObra — RECREACIÓN de aiu_configs (tabla dañada por DROP+ADD a medias)
-- =============================================================================
-- Ejecutar en phpMyAdmin → BD u652436213_ControlObra → pestaña SQL
-- Esta migration es SEGURA: usa CREATE TABLE IF NOT EXISTS.
-- Si la tabla ya existe (porque vos la restauraste), no hace nada.
--
-- Después de correr esto, hay que re-crear las configs de AIU desde la UI
-- de la app (Configuración del Proyecto → AIU). Los datos viejos se
-- perdieron al corromperse la tabla, pero eran solo 1-3 filas de % por
-- proyecto, no datos de negocio.
-- =============================================================================

-- Recrear tabla con la estructura "buena" del init.sql + el check de rango
CREATE TABLE IF NOT EXISTS aiu_configs (
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
  CONSTRAINT chk_aiu_range CHECK (administration BETWEEN 0 AND 100
                              AND imprevistos    BETWEEN 0 AND 100
                              AND utilidad       BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- (Si la tabla ya existía, el IF NOT EXISTS de arriba no hace nada y este
-- script simplemente confirma que la estructura está bien. Si querés
-- regenerar el CHECK a mano, podés correr:)
--   ALTER TABLE aiu_configs DROP CONSTRAINT chk_aiu_range;
--   ALTER TABLE aiu_configs ADD CONSTRAINT chk_aiu_range CHECK (
--     administration BETWEEN 0 AND 100
--     AND imprevistos BETWEEN 0 AND 100
--     AND utilidad BETWEEN 0 AND 100);

-- Verificación final
SELECT 'aiu_configs recreada' AS check_name,
       (SELECT COUNT(*) FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = 'aiu_configs') AS existe,
       (SELECT COUNT(*) FROM information_schema.table_constraints
         WHERE table_schema = DATABASE() AND table_name = 'aiu_configs'
           AND constraint_name = 'chk_aiu_range') AS check_rango;
