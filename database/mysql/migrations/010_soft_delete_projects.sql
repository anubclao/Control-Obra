-- =============================================================================
-- Migracion 010: soft delete en `projects` + proteccion de auditoria
-- financiera.
--
-- P0 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.2):
--   Borrar un proyecto borraba en cascada sus cortes, pagos (incluso los
--   PAID) y aprobaciones, destruyendo la auditoria financiera. Esta
--   migracion:
--     1) agrega `deleted_at` y `deleted_by` a `projects` para soft delete;
--     2) cambia el handler DELETE para hacer UPDATE de `deleted_at` en vez
--        de DELETE fisico;
--     3) cambia las FK que apuntaban en CASCADE contra `projects(id)` a
--        RESTRICT, de modo que la BD misma impida borrar un proyecto con
--        pagos/cortes aprobados mientras el handler no haga soft delete.
--
-- Las FK que estaban en SET NULL (provider_id, work_cut_id en
-- payment_requests; created_by en project_references) no se tocan: ya son
-- seguras. Solo cambiamos las que estaban en CASCADE.
--
-- Idempotente: usa ALTER ... DROP/ADD para re-ejecucion segura en entornos
-- de desarrollo. En produccion aplicar una sola vez.
-- =============================================================================

-- 1) Columnas de soft delete en projects -------------------------------------
SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'projects'
    AND column_name = 'deleted_at'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE projects ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL AFTER updated_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'projects'
    AND column_name = 'deleted_by'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE projects ADD COLUMN deleted_by VARCHAR(36) NULL DEFAULT NULL AFTER deleted_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Indice para que los listados filtren rapido los no borrados.
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'projects'
    AND index_name = 'idx_proj_deleted_at'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_proj_deleted_at ON projects (deleted_at)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) FK work_cuts.project_id: CASCADE -> RESTRICT ----------------------------
--    Antes: borrar un proyecto arrastraba todos los cortes (y los items,
--    aprobaciones y documentos ligados a ellos). Ahora la BD rechaza el
--    DELETE fisico de un proyecto con cortes; el handler hace soft delete.
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'work_cuts'
    AND constraint_name = 'fk_wcut_project'
);
SET @sql := IF(@fk_exists = 1,
  'ALTER TABLE work_cuts DROP FOREIGN KEY fk_wcut_project',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'work_cuts'
    AND constraint_name = 'fk_wcut_project'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE work_cuts ADD CONSTRAINT fk_wcut_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) FK payment_requests.project_id: CASCADE -> RESTRICT ---------------------
--    Antes: borrar un proyecto borraba los pagos PAID y su historial de
--    aprobaciones. Ahora la BD lo impide; el handler usa soft delete.
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'payment_requests'
    AND constraint_name = 'fk_pay_project'
);
SET @sql := IF(@fk_exists = 1,
  'ALTER TABLE payment_requests DROP FOREIGN KEY fk_pay_project',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'payment_requests'
    AND constraint_name = 'fk_pay_project'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE payment_requests ADD CONSTRAINT fk_pay_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
