-- =============================================================================
-- Migracion 016: payment_requests.replaces_request_id (P2 plan 2026-10-01)
--
-- Por que existe: cuando se rechaza una solicitud de pago (status =
-- REJECTED), los usuarios suelen querer corregir el monto, el
-- beneficiario o el corte de trabajo y crear una nueva solicitud que
-- la "reemplaza". Hasta ahora no existia forma de vincular ambas
-- solicitudes, asi que el historial quedaba cortado y era imposible
-- responder "esta solicitud reemplazo a tal otra".
--
-- Esta columna guarda el id de la solicitud rechazada original. Solo
-- se permite si el id referenciado esta en status = REJECTED; la
-- validacion se hace en la aplicacion (lib/payments-workflow.ts y
-- la ruta POST /api/payments), porque MySQL no permite CHECKs
-- condicionales contra otra fila de forma nativa.
--
-- La columna es NULL por defecto (las solicitudes originales siguen
-- funcionando sin tocar nada).
-- =============================================================================

SET @col_exists := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'payment_requests'
     AND COLUMN_NAME  = 'replaces_request_id'
);

SET @sql := IF(@col_exists = 0,
  'ALTER TABLE payment_requests
     ADD COLUMN replaces_request_id VARCHAR(36) NULL AFTER work_cut_id,
     ADD CONSTRAINT fk_pay_replaces
       FOREIGN KEY (replaces_request_id) REFERENCES payment_requests(id)
       ON DELETE SET NULL,
     ADD INDEX idx_pay_replaces (replaces_request_id)',
  'SELECT "016: replaces_request_id ya existe, skip" AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
