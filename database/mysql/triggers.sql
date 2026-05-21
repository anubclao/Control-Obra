-- =============================================
-- CONTROL DE OBRA - MySQL Triggers
-- =============================================
-- Ejecutar después de crear las tablas y funciones
-- Los triggers mantienen consistencia de datos calculados

USE control_obra_db;


-- =============================================
-- TRIGGERS: BudgetItem → actualiza totales de BudgetLayer
-- =============================================

DROP TRIGGER IF EXISTS tr_budget_item_after_insert;
DROP TRIGGER IF EXISTS tr_budget_item_after_update;
DROP TRIGGER IF EXISTS tr_budget_item_after_delete;

DELIMITER $$

-- Después de insertar un ítem: actualiza totales de la capa
CREATE TRIGGER tr_budget_item_after_insert
AFTER INSERT ON BudgetItem
FOR EACH ROW
BEGIN
    UPDATE BudgetLayer
    SET
        totalDirectCostPC = (SELECT COALESCE(SUM(totalPC), 0) FROM BudgetItem WHERE layerId = NEW.layerId),
        totalDirectCostPT = (SELECT COALESCE(SUM(totalPT), 0) FROM BudgetItem WHERE layerId = NEW.layerId),
        updatedAt = NOW()
    WHERE id = NEW.layerId;
END$$


-- Después de actualizar un ítem: actualiza totales de la capa
CREATE TRIGGER tr_budget_item_after_update
AFTER UPDATE ON BudgetItem
FOR EACH ROW
BEGIN
    -- Actualizar la capa afectada (puede haber cambiado de capa)
    UPDATE BudgetLayer
    SET
        totalDirectCostPC = (SELECT COALESCE(SUM(totalPC), 0) FROM BudgetItem WHERE layerId = NEW.layerId),
        totalDirectCostPT = (SELECT COALESCE(SUM(totalPT), 0) FROM BudgetItem WHERE layerId = NEW.layerId),
        updatedAt = NOW()
    WHERE id = NEW.layerId;

    -- Si cambió de capa, actualizar la capa anterior también
    IF OLD.layerId != NEW.layerId THEN
        UPDATE BudgetLayer
        SET
            totalDirectCostPC = (SELECT COALESCE(SUM(totalPC), 0) FROM BudgetItem WHERE layerId = OLD.layerId),
            totalDirectCostPT = (SELECT COALESCE(SUM(totalPT), 0) FROM BudgetItem WHERE layerId = OLD.layerId),
            updatedAt = NOW()
        WHERE id = OLD.layerId;
    END IF;
END$$


-- Después de eliminar un ítem: actualiza totales de la capa
CREATE TRIGGER tr_budget_item_after_delete
AFTER DELETE ON BudgetItem
FOR EACH ROW
BEGIN
    UPDATE BudgetLayer
    SET
        totalDirectCostPC = (SELECT COALESCE(SUM(totalPC), 0) FROM BudgetItem WHERE layerId = OLD.layerId),
        totalDirectCostPT = (SELECT COALESCE(SUM(totalPT), 0) FROM BudgetItem WHERE layerId = OLD.layerId),
        updatedAt = NOW()
    WHERE id = OLD.layerId;
END$$

DELIMITER ;


-- =============================================
-- TRIGGERS: BudgetLayer → actualiza totales de Budget
-- =============================================

DROP TRIGGER IF EXISTS tr_budget_layer_after_update;

DELIMITER $$

-- Después de actualizar una capa: recalcula totales del presupuesto
CREATE TRIGGER tr_budget_layer_after_update
AFTER UPDATE ON BudgetLayer
FOR EACH ROW
BEGIN
    DECLARE v_total_pc         DECIMAL(20,2);
    DECLARE v_total_pt         DECIMAL(20,2);
    DECLARE v_aiu_pc           DECIMAL(20,2);
    DECLARE v_aiu_pt           DECIMAL(20,2);
    DECLARE v_iva_pc           DECIMAL(20,2);
    DECLARE v_iva_pt           DECIMAL(20,2);
    DECLARE v_admin_pct        DECIMAL(5,2);
    DECLARE v_imprev_pct       DECIMAL(5,2);
    DECLARE v_util_pct         DECIMAL(5,2);
    DECLARE v_iva_util_pct     DECIMAL(5,2);

    -- Obtener porcentajes del presupuesto
    SELECT adminPercentage, imprevistoPercentage, utilidadPercentage, ivaUtilityPercentage
    INTO v_admin_pct, v_imprev_pct, v_util_pct, v_iva_util_pct
    FROM Budget WHERE id = NEW.budgetId;

    -- Sumar costos directos de todas las capas
    SELECT
        COALESCE(SUM(totalDirectCostPC), 0),
        COALESCE(SUM(totalDirectCostPT), 0)
    INTO v_total_pc, v_total_pt
    FROM BudgetLayer WHERE budgetId = NEW.budgetId;

    -- Calcular AIU
    SET v_aiu_pc = fn_calc_aiu(v_total_pc, v_admin_pct, v_imprev_pct, v_util_pct, v_iva_util_pct);
    SET v_aiu_pt = fn_calc_aiu(v_total_pt, v_admin_pct, v_imprev_pct, v_util_pct, v_iva_util_pct);

    -- IVA sobre utilidad
    SET v_iva_pc = v_total_pc * (v_util_pct / 100) * (v_iva_util_pct / 100);
    SET v_iva_pt = v_total_pt * (v_util_pct / 100) * (v_iva_util_pct / 100);

    -- Actualizar totales del presupuesto
    UPDATE Budget SET
        totalDirectCostPC   = v_total_pc,
        totalDirectCostPT   = v_total_pt,
        totalAIU_PC         = v_aiu_pc,
        totalAIU_PT         = v_aiu_pt,
        totalIvaUtilidad_PC = v_iva_pc,
        totalIvaUtilidad_PT = v_iva_pt,
        totalPC             = v_total_pc + v_aiu_pc,
        totalPT             = v_total_pt + v_aiu_pt,
        updatedAt           = NOW()
    WHERE id = NEW.budgetId;
END$$

DELIMITER ;


-- =============================================
-- TRIGGERS: PaymentApproval → actualiza estado de PaymentRequest
-- =============================================

DROP TRIGGER IF EXISTS tr_payment_approval_after_insert;

DELIMITER $$

CREATE TRIGGER tr_payment_approval_after_insert
AFTER INSERT ON PaymentApproval
FOR EACH ROW
BEGIN
    DECLARE v_required_level  INT;
    DECLARE v_current_status  VARCHAR(30);

    SELECT requiredApprovalLevel, status
    INTO v_required_level, v_current_status
    FROM PaymentRequest WHERE id = NEW.paymentRequestId;

    IF NEW.action = 'REJECTED' THEN
        UPDATE PaymentRequest SET
            status = 'REJECTED',
            rejectionReason = NEW.comments,
            updatedAt = NOW()
        WHERE id = NEW.paymentRequestId;

    ELSEIF NEW.action = 'APPROVED' THEN
        IF NEW.level = 1 AND v_required_level >= 2 THEN
            UPDATE PaymentRequest SET
                status = 'APPROVED_LEVEL_1',
                currentApprovalLevel = 2,
                updatedAt = NOW()
            WHERE id = NEW.paymentRequestId;
        ELSEIF NEW.level = 2 AND v_required_level >= 3 THEN
            UPDATE PaymentRequest SET
                status = 'APPROVED_LEVEL_2',
                currentApprovalLevel = 3,
                updatedAt = NOW()
            WHERE id = NEW.paymentRequestId;
        ELSE
            UPDATE PaymentRequest SET
                status = 'APPROVED',
                updatedAt = NOW()
            WHERE id = NEW.paymentRequestId;
        END IF;
    END IF;
END$$

DELIMITER ;


-- =============================================
-- TRIGGERS: WorkCut → actualiza status de Contractor
-- =============================================

DROP TRIGGER IF EXISTS tr_work_cut_after_update;

DELIMITER $$

-- Cuando se aprueba un corte, verificar si el subcontratista tiene todos los docs
CREATE TRIGGER tr_work_cut_after_update
AFTER UPDATE ON WorkCut
FOR EACH ROW
BEGIN
    DECLARE v_required_docs  INT DEFAULT 4;  -- CEDULA, RUT, CAMARA_COMERCIO, CERTIFICADO_BANCARIO
    DECLARE v_docs_count     INT;

    IF NEW.status = 'APPROVED' AND OLD.status != 'APPROVED' THEN
        -- Contar documentos vigentes del subcontratista
        SELECT COUNT(DISTINCT type) INTO v_docs_count
        FROM Document
        WHERE contractorId = NEW.contractorId
            AND (expirationDate IS NULL OR expirationDate >= CURDATE());

        -- Actualizar status del subcontratista
        UPDATE Contractor SET
            status = IF(v_docs_count >= v_required_docs, 'COMPLETE', 'INCOMPLETE'),
            updatedAt = NOW()
        WHERE id = NEW.contractorId;
    END IF;
END$$

DELIMITER ;


-- =============================================
-- TRIGGERS: Document → actualiza status de Contractor automáticamente
-- =============================================

DROP TRIGGER IF EXISTS tr_document_after_insert;
DROP TRIGGER IF EXISTS tr_document_after_delete;

DELIMITER $$

CREATE TRIGGER tr_document_after_insert
AFTER INSERT ON Document
FOR EACH ROW
BEGIN
    DECLARE v_docs_count INT;

    SELECT COUNT(DISTINCT type) INTO v_docs_count
    FROM Document
    WHERE contractorId = NEW.contractorId
        AND (expirationDate IS NULL OR expirationDate >= CURDATE());

    UPDATE Contractor SET
        status = IF(v_docs_count >= 4, 'COMPLETE', 'INCOMPLETE'),
        updatedAt = NOW()
    WHERE id = NEW.contractorId;
END$$


CREATE TRIGGER tr_document_after_delete
AFTER DELETE ON Document
FOR EACH ROW
BEGIN
    DECLARE v_docs_count INT;

    SELECT COUNT(DISTINCT type) INTO v_docs_count
    FROM Document
    WHERE contractorId = OLD.contractorId
        AND (expirationDate IS NULL OR expirationDate >= CURDATE());

    UPDATE Contractor SET
        status = IF(v_docs_count >= 4, 'COMPLETE', 'INCOMPLETE'),
        updatedAt = NOW()
    WHERE id = OLD.contractorId;
END$$

DELIMITER ;


-- =============================================
-- TRIGGERS: Audit Log para cambios críticos
-- Requiere tabla AuditLog (no en el schema Prisma, creada aquí)
-- =============================================

CREATE TABLE IF NOT EXISTS AuditLog (
    id          VARCHAR(25) NOT NULL PRIMARY KEY,
    tableName   VARCHAR(50) NOT NULL,
    recordId    VARCHAR(25) NOT NULL,
    action      ENUM('INSERT','UPDATE','DELETE') NOT NULL,
    changedField VARCHAR(100),
    oldValue    TEXT,
    newValue    TEXT,
    changedAt   DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_table_record (tableName, recordId),
    INDEX idx_audit_changed_at (changedAt)
);

DROP TRIGGER IF EXISTS tr_project_status_audit;

DELIMITER $$

-- Auditar cambios de estado en proyectos
CREATE TRIGGER tr_project_status_audit
AFTER UPDATE ON Project
FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO AuditLog (id, tableName, recordId, action, changedField, oldValue, newValue)
        VALUES (
            CONCAT('aud_', UNIX_TIMESTAMP(NOW(6)), '_', FLOOR(RAND() * 10000)),
            'Project',
            NEW.id,
            'UPDATE',
            'status',
            OLD.status,
            NEW.status
        );
    END IF;
END$$

DELIMITER ;

DROP TRIGGER IF EXISTS tr_payment_status_audit;

DELIMITER $$

-- Auditar cambios de estado en pagos
CREATE TRIGGER tr_payment_status_audit
AFTER UPDATE ON PaymentRequest
FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO AuditLog (id, tableName, recordId, action, changedField, oldValue, newValue)
        VALUES (
            CONCAT('aud_', UNIX_TIMESTAMP(NOW(6)), '_', FLOOR(RAND() * 10000)),
            'PaymentRequest',
            NEW.id,
            'UPDATE',
            'status',
            OLD.status,
            NEW.status
        );
    END IF;
END$$

DELIMITER ;
