-- 006_document_generation.sql
-- Migración idempotente. Agrega:
--   1) Tabla document_generation_log (registro de cada generación+upload).
--   2) Columna generated_document_url en las 6 entidades que producen
--      documentos, para persistir el último webUrl devuelto por SharePoint.
--
-- Ver docs/specs/document-generation-sharepoint.md §4.5.
--
-- NOTA: MySQL 8.0 (al menos 8.0.46) NO soporta `ADD COLUMN IF NOT EXISTS`
-- en ALTER TABLE. Por eso la columna se agrega desde el script
-- `scripts/apply-migration.mjs`, que primero consulta information_schema
-- y luego hace el ALTER solo si la columna no existe. Esta migración SQL
-- solo crea la tabla de log, que sí soporta `CREATE TABLE IF NOT EXISTS`.

-- 1) Tabla de log ------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_generation_log (
  id              CHAR(36) PRIMARY KEY,
  entity          VARCHAR(32) NOT NULL,
  entity_id       CHAR(36) NOT NULL,
  template_id     VARCHAR(32) NOT NULL,
  file_name       VARCHAR(255) NOT NULL,
  sharepoint_path TEXT NOT NULL,
  web_url         TEXT NOT NULL,
  status          ENUM('OK','ERROR') NOT NULL,
  error_code      VARCHAR(64) NULL,
  duration_ms     INT UNSIGNED NOT NULL,
  user_id         CHAR(36) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_entity        (entity, entity_id),
  INDEX idx_created       (created_at),
  INDEX idx_status        (status),
  INDEX idx_template      (template_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Columnas generated_document_url en entidades ----------------------
-- Se aplican desde el script con un information_schema guard:
--   ALTER TABLE <t> ADD COLUMN generated_document_url TEXT NULL
-- sólo si information_schema.COLUMNS no la tiene.
