-- =============================================================================
-- Migracion 017: Articulacion modulo Contabilidad (Fase 1 + 2)
--
-- Por que existe, cuando existe: P0 plan 2026-10-02. El modulo
-- /api/accounting/ existia pero estaba DESARTICULADO del resto del sistema.
-- Un pago en /api/payments que pasaba a PAID, un corte APPROVED, o un
-- gasto PAGADO NO generaba ningun movimiento contable. Esto hacia que el
-- panel contable quedara vacio aun cuando la empresa llevaba operando
-- semanas.
--
-- Esta migracion agrega tres columnas para permitir la auto-creacion
-- de asientos (Fase 1) y mejores validaciones (Fase 2):
--
--   1) payment_requests.account_id
--      -> La cuenta bancaria donde Tesoreria realizo la transferencia
--         al marcar la solicitud como PAID. Requerido por el helper
--         accounting_expenses con status PAGADO. La UI pedira este campo
--         en la accion PAY (antes era solo paymentReference + paymentMethod).
--
--   2) accounting_tax_movements.tax_type
--      -> FK a tax_configs.type. Antes 0 lo habilitamos: solo existia
--         `description` libre, lo que impedia filtrar "total IVA del
--         ano" sin texto. Ahora se puede reportar por tipo (IVA,
--         RETENCION_FUENTE, RETENCION_IVA, RETENCION_ICA, ESTAMPILLAS,
--         OTROS). Nullable para mantener compatibilidad.
--
--   3) accounting_expenses.expense_source_id y expense_source_type
--      -> Vincula el gasto contable con su origen real (payment_request.id
--         o expense.id o work_cut.id). Permite navegar del panel
--         contable al documento de obra que lo origino. Idempotente:
--         si ya existe el asiento para ese origen, no se duplica.
--         Indice UNIQUE por (source_type, source_id) para garantizarlo.
--
-- Compatibilidad: 100% aditiva. Las columnas son NULL por defecto.
-- No se rompen pagos/gastos/§-movimientos pre-existentes.
-- =============================================================================

USE control_obra;

-- -----------------------------------------------------------------------------
-- 1) payment_requests.account_id
-- -----------------------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'payment_requests'
     AND COLUMN_NAME  = 'account_id'
);

SET @sql := IF(@col_exists = 0,
  'ALTER TABLE payment_requests
     ADD COLUMN account_id VARCHAR(36) NULL AFTER paid_method,
     ADD CONSTRAINT fk_pay_account
       FOREIGN KEY (account_id) REFERENCES accounting_accounts(id)
       ON DELETE RESTRICT,
     ADD INDEX idx_pay_account (account_id)',
  'SELECT "017: payment_requests.account_id ya existe, skip" AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- 2) accounting_tax_movements.tax_type
-- -----------------------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'accounting_tax_movements'
     AND COLUMN_NAME  = 'tax_type'
);

SET @sql := IF(@col_exists = 0,
  'ALTER TABLE accounting_tax_movements
     ADD COLUMN tax_type ENUM(''IVA'',''RETENCION_FUENTE'',''RETENCION_IVA'',''RETENCION_ICA'',''ESTAMPILLAS'',''OTROS'')
                                 NULL AFTER description,
     ADD INDEX idx_acc_tax_type (tax_type)',
  'SELECT "017: accounting_tax_movements.tax_type ya existe, skip" AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- 3) accounting_expenses.expense_source_type + expense_source_id
--    + UNIQUE(source_type, source_id) para idempotencia
-- -----------------------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'accounting_expenses'
     AND COLUMN_NAME  = 'expense_source_type'
);

SET @sql := IF(@col_exists = 0,
  'ALTER TABLE accounting_expenses
     ADD COLUMN expense_source_type ENUM(''PAYMENT_REQUEST'',''EXPENSE'',''WORK_CUT'')
                                       NULL AFTER account_id,
     ADD COLUMN expense_source_id   VARCHAR(36) NULL AFTER expense_source_type,
     ADD UNIQUE KEY uq_acc_expense_source (expense_source_type, expense_source_id),
     ADD INDEX idx_acc_expense_source_type (expense_source_type)',
  'SELECT "017: accounting_expenses.expense_source_* ya existe, skip" AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- Verificacion
-- -----------------------------------------------------------------------------
-- Esperado:
--   payment_requests.account_id              VARCHAR(36) NULL
--   accounting_tax_movements.tax_type        ENUM(...) NULL
--   accounting_expenses.expense_source_type  ENUM(...) NULL
--   accounting_expenses.expense_source_id    VARCHAR(36) NULL
--   UNIQUE KEY uq_acc_expense_source (expense_source_type, expense_source_id)
--
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = DATABASE()
--    AND ((table_name = 'payment_requests' AND column_name = 'account_id')
--     OR (table_name = 'accounting_tax_movements' AND column_name = 'tax_type')
--     OR (table_name = 'accounting_expenses' AND column_name IN ('expense_source_type','expense_source_id')))
--  ORDER BY table_name, column_name;