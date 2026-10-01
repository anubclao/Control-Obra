-- =============================================================================
-- Migracion 015: user_sessions (sesion revocable)
--
-- P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.4):
--   Hoy la cookie `co_session` solo firma el userId (HMAC). Una cookie
--   robada sirve hasta que se cambie la SESSION_SECRET. Ademas el
--   logout solo borra la cookie del navegador, no invalida la sesion
--   en el servidor. Con esta tabla:
--     1. La cookie firma userId|exp y se rechaza si exp < now.
--     2. Cada sesion activa tiene una fila aqui; el servidor la
--        consulta y devuelve 401 si esta revocada.
--     3. Logout = marcar revoked_at = NOW().
--     4. Suspensión de usuario = revocar TODAS sus sesiones.
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  user_id         VARCHAR(36)  NOT NULL,
  -- token_id: subfijo random presente en la cookie. Asi el servidor
  -- puede revocar UNA sesion sin invalidar todas las del usuario.
  token_id        VARCHAR(64)  NOT NULL UNIQUE,
  expires_at      DATETIME     NOT NULL,
  revoked_at      DATETIME     NULL,
  revoked_reason  VARCHAR(255) NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip              VARCHAR(45)  NULL,
  user_agent      VARCHAR(255) NULL,
  CONSTRAINT fk_us_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_us_user (user_id, expires_at),
  INDEX idx_us_token (token_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
