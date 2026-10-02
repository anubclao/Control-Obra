-- =============================================================================
-- Migracion 012: tabla beneficiary_accounts (P1, docs seccion 4.2)
--
-- Por que existe: payment_requests.account_number esta en claro y ademas
-- se desnormaliza (cada solicitud copia banco, tipo y numero del
-- beneficiario). Aqui centralizamos la cuenta por proveedor:
--   - provider_id referencia a providers
--   - bank_name, account_type, account_number cifrado (columna
--     account_number_cipher para guardar el resultado de
--     lib/crypto.encryptColumn)
--   - is_default marca la cuenta principal del proveedor
--   - deleted_at + deleted_by para soft delete coherente con 010/011
--
-- Cambios minimos en payment_requests para no romper compatibilidad:
--   - Agregamos beneficiary_account_id (NULL permitido) para que las
--     rutas migren gradualmente. La columna account_number se conserva
--     como texto plano para no romper GET existentes; las migraciones
--     futuras haran el backfill y podran nulificarla.
-- =============================================================================

CREATE TABLE IF NOT EXISTS beneficiary_accounts (
  id                    VARCHAR(36)   NOT NULL PRIMARY KEY,
  provider_id           VARCHAR(36)   NOT NULL,
  bank_name             VARCHAR(120)  NOT NULL,
  account_type          ENUM('SAVINGS','CHECKING') NOT NULL,
  account_number_cipher TEXT          NOT NULL,
  account_number_last4  CHAR(4)       NOT NULL,
  is_default            TINYINT(1)    NOT NULL DEFAULT 0,
  created_by            VARCHAR(36),
  created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by            VARCHAR(36),
  updated_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at            DATETIME      NULL DEFAULT NULL,
  deleted_by            VARCHAR(36),
  CONSTRAINT fk_bacc_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_bacc_creator  FOREIGN KEY (created_by)  REFERENCES users(id)    ON DELETE SET NULL,
  INDEX idx_bacc_provider (provider_id, is_default),
  INDEX idx_bacc_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- payment_requests.beneficiary_account_id (NULL permitido en transicion)
SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'payment_requests'
               AND column_name = 'beneficiary_account_id');
SET @sql := IF(@col = 0,
  'ALTER TABLE payment_requests ADD COLUMN beneficiary_account_id VARCHAR(36) NULL DEFAULT NULL AFTER account_number',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
             WHERE table_schema = DATABASE() AND table_name = 'payment_requests'
               AND index_name = 'idx_pay_beneficiary_account');
SET @sql := IF(@idx = 0,
  'CREATE INDEX idx_pay_beneficiary_account ON payment_requests (beneficiary_account_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.table_constraints
            WHERE constraint_schema = DATABASE()
              AND table_name = 'payment_requests'
              AND constraint_name = 'fk_pay_beneficiary_account');
SET @sql := IF(@fk = 0,
  'ALTER TABLE payment_requests ADD CONSTRAINT fk_pay_beneficiary_account FOREIGN KEY (beneficiary_account_id) REFERENCES beneficiary_accounts(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
