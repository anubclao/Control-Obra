-- =============================================================================
-- Migracion 013: client_stage_history
--
-- P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.2 + 4.1):
--   Hoy la guia dice "solo se puede avanzar" en el pipeline, pero el
--   servidor acepta cualquier cambio de status en clients.status y no
--   queda registro de las transiciones. Esta tabla guarda cada
--   movimiento (incluyendo LOST con motivo) para que el historial del
--   cliente sea auditable.
-- =============================================================================

CREATE TABLE IF NOT EXISTS client_stage_history (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  client_id       VARCHAR(36)  NOT NULL,
  from_status     ENUM('PROSPECT','CONTACTED','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST') NULL,
  to_status       ENUM('PROSPECT','CONTACTED','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST') NOT NULL,
  reason          TEXT,
  changed_by      VARCHAR(36),
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_csh_client  FOREIGN KEY (client_id)  REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_csh_changed FOREIGN KEY (changed_by) REFERENCES users(id)   ON DELETE SET NULL,
  INDEX idx_csh_client (client_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
