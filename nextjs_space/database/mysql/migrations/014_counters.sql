-- =============================================================================
-- Migracion 014: tabla counters (P2, docs seccion 4.1)
--
-- Por que existe: los consecutivos PAG-, CO-, CLI-, COT- se generan
-- con `Date.now().toString(36)` recortado, lo que puede colisionar
-- y no es secuencial. Aqui centralizamos la numeracion:
--   - (entity, year) UNIQUE
--   - last_number autoincrementa
--   - prefijo permite formatear a la primera
--
-- El helper `nextSequence()` (lib/counters.ts) hace INSERT ... ON
-- DUPLICATE KEY UPDATE last_number = last_number + 1 dentro de una
-- transaccion, y devuelve el nuevo numero formateado.
-- =============================================================================

CREATE TABLE IF NOT EXISTS counters (
  entity      VARCHAR(40)  NOT NULL,
  year        INT          NOT NULL,
  prefix      VARCHAR(10)  NOT NULL,
  last_number INT          NOT NULL DEFAULT 0,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (entity, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
