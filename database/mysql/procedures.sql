-- =============================================
-- CONTROL DE OBRA - MySQL Stored Procedures
-- =============================================
-- Ejecutar después de triggers.sql

USE control_obra_db;


-- =============================================
-- sp_recalculate_budget
-- Recalcula todos los totales de un presupuesto en cascada
-- (layer totals → budget totals con AIU)
-- =============================================
DROP PROCEDURE IF EXISTS sp_recalculate_budget;

DELIMITER $$
CREATE PROCEDURE sp_recalculate_budget(IN p_budget_id VARCHAR(25))
BEGIN
    DECLARE v_admin_pct    DECIMAL(5,2);
    DECLARE v_imprev_pct   DECIMAL(5,2);
    DECLARE v_util_pct     DECIMAL(5,2);
    DECLARE v_iva_util_pct DECIMAL(5,2);
    DECLARE v_total_pc     DECIMAL(20,2) DEFAULT 0;
    DECLARE v_total_pt     DECIMAL(20,2) DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- Obtener porcentajes del presupuesto
    SELECT adminPercentage, imprevistoPercentage, utilidadPercentage, ivaUtilityPercentage
    INTO v_admin_pct, v_imprev_pct, v_util_pct, v_iva_util_pct
    FROM Budget WHERE id = p_budget_id;

    -- 1. Actualizar totales de cada capa desde sus ítems
    UPDATE BudgetLayer bl
    SET
        totalDirectCostPC = (
            SELECT COALESCE(SUM(totalPC), 0)
            FROM BudgetItem WHERE layerId = bl.id
        ),
        totalDirectCostPT = (
            SELECT COALESCE(SUM(totalPT), 0)
            FROM BudgetItem WHERE layerId = bl.id
        ),
        updatedAt = NOW()
    WHERE bl.budgetId = p_budget_id;

    -- 2. Sumar totales de capas para el presupuesto
    SELECT
        COALESCE(SUM(totalDirectCostPC), 0),
        COALESCE(SUM(totalDirectCostPT), 0)
    INTO v_total_pc, v_total_pt
    FROM BudgetLayer WHERE budgetId = p_budget_id;

    -- 3. Actualizar totales del presupuesto con AIU
    UPDATE Budget SET
        totalDirectCostPC   = v_total_pc,
        totalDirectCostPT   = v_total_pt,
        totalAIU_PC         = fn_calc_aiu(v_total_pc, v_admin_pct, v_imprev_pct, v_util_pct, v_iva_util_pct),
        totalAIU_PT         = fn_calc_aiu(v_total_pt, v_admin_pct, v_imprev_pct, v_util_pct, v_iva_util_pct),
        totalIvaUtilidad_PC = v_total_pc * (v_util_pct / 100) * (v_iva_util_pct / 100),
        totalIvaUtilidad_PT = v_total_pt * (v_util_pct / 100) * (v_iva_util_pct / 100),
        totalPC = v_total_pc + fn_calc_aiu(v_total_pc, v_admin_pct, v_imprev_pct, v_util_pct, v_iva_util_pct),
        totalPT = v_total_pt + fn_calc_aiu(v_total_pt, v_admin_pct, v_imprev_pct, v_util_pct, v_iva_util_pct),
        updatedAt = NOW()
    WHERE id = p_budget_id;

    -- 4. Actualizar status de cada ítem (GREEN/YELLOW/RED)
    UPDATE BudgetItem bi
    JOIN BudgetLayer bl ON bl.id = bi.layerId
    SET bi.status = fn_budget_item_status(bi.totalPC, bi.totalPT),
        bi.updatedAt = NOW()
    WHERE bl.budgetId = p_budget_id;

    COMMIT;
END$$
DELIMITER ;


-- =============================================
-- sp_approve_payment
-- Procesa una aprobación de pago con control de niveles
-- OUT p_new_status: el nuevo estado del pago
-- =============================================
DROP PROCEDURE IF EXISTS sp_approve_payment;

DELIMITER $$
CREATE PROCEDURE sp_approve_payment(
    IN  p_payment_id   VARCHAR(25),
    IN  p_approver_id  VARCHAR(25),
    IN  p_level        INT,
    IN  p_comments     TEXT,
    OUT p_new_status   VARCHAR(30)
)
BEGIN
    DECLARE v_current_level   INT;
    DECLARE v_required_level  INT;
    DECLARE v_current_status  VARCHAR(30);
    DECLARE v_approval_id     VARCHAR(25);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT currentApprovalLevel, requiredApprovalLevel, status
    INTO v_current_level, v_required_level, v_current_status
    FROM PaymentRequest WHERE id = p_payment_id FOR UPDATE;

    -- Verificar que el pago está en estado correcto para aprobar
    IF v_current_status NOT IN ('PENDING','APPROVED_LEVEL_1','APPROVED_LEVEL_2') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'El pago no está en un estado que permita aprobación';
    END IF;

    -- Verificar que el nivel de aprobación es correcto
    IF p_level != v_current_level THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'El nivel de aprobación no corresponde al nivel actual del pago';
    END IF;

    -- Generar ID para la aprobación
    SET v_approval_id = CONCAT('apl_', UNIX_TIMESTAMP(NOW(6)));

    -- Registrar la aprobación
    INSERT INTO PaymentApproval (id, level, action, comments, paymentRequestId, approverId, createdAt)
    VALUES (v_approval_id, p_level, 'APPROVED', p_comments, p_payment_id, p_approver_id, NOW());

    -- El trigger tr_payment_approval_after_insert actualiza el status
    -- Leer el nuevo status actualizado por el trigger
    SELECT status INTO p_new_status FROM PaymentRequest WHERE id = p_payment_id;

    COMMIT;
END$$
DELIMITER ;


-- =============================================
-- sp_reject_payment
-- Rechaza un pago con razón de rechazo
-- =============================================
DROP PROCEDURE IF EXISTS sp_reject_payment;

DELIMITER $$
CREATE PROCEDURE sp_reject_payment(
    IN p_payment_id  VARCHAR(25),
    IN p_approver_id VARCHAR(25),
    IN p_level       INT,
    IN p_comments    TEXT
)
BEGIN
    DECLARE v_current_status VARCHAR(30);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT status INTO v_current_status
    FROM PaymentRequest WHERE id = p_payment_id FOR UPDATE;

    IF v_current_status NOT IN ('PENDING','APPROVED_LEVEL_1','APPROVED_LEVEL_2') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'El pago no está en un estado que permita rechazo';
    END IF;

    -- Registrar el rechazo
    INSERT INTO PaymentApproval (id, level, action, comments, paymentRequestId, approverId, createdAt)
    VALUES (CONCAT('apl_', UNIX_TIMESTAMP(NOW(6))), p_level, 'REJECTED', p_comments, p_payment_id, p_approver_id, NOW());

    -- El trigger tr_payment_approval_after_insert actualiza el status
    COMMIT;
END$$
DELIMITER ;


-- =============================================
-- sp_get_project_dashboard
-- Devuelve todos los datos del dashboard de un proyecto
-- (pagos, cortes, presupuesto, bitácora reciente)
-- =============================================
DROP PROCEDURE IF EXISTS sp_get_project_dashboard;

DELIMITER $$
CREATE PROCEDURE sp_get_project_dashboard(IN p_project_id VARCHAR(25))
BEGIN
    -- Resumen del proyecto
    SELECT * FROM v_project_summary WHERE projectId = p_project_id;

    -- Resumen financiero
    SELECT * FROM v_financial_summary WHERE projectId = p_project_id;

    -- Últimos 5 cortes
    SELECT * FROM v_work_cut_summary
    WHERE projectId = p_project_id
    ORDER BY createdAt DESC LIMIT 5;

    -- Últimos 5 pagos
    SELECT * FROM v_payment_dashboard
    WHERE projectId = p_project_id
    ORDER BY createdAt DESC LIMIT 5;

    -- Presupuesto por capa
    SELECT
        layerCode,
        layerName,
        SUM(totalPC) AS totalPC,
        SUM(totalPT) AS totalPT,
        SUM(executedValuePC) AS executedPC,
        AVG(progressPct) AS avgProgressPct
    FROM v_budget_progress
    WHERE projectId = p_project_id
    GROUP BY layerCode, layerName
    ORDER BY layerCode;
END$$
DELIMITER ;


-- =============================================
-- sp_get_financial_report
-- Reporte financiero completo de un proyecto en un rango de fechas
-- =============================================
DROP PROCEDURE IF EXISTS sp_get_financial_report;

DELIMITER $$
CREATE PROCEDURE sp_get_financial_report(
    IN p_project_id VARCHAR(25),
    IN p_start_date DATE,
    IN p_end_date   DATE
)
BEGIN
    -- Resumen general
    SELECT
        fs.*,
        fn_format_cop(fs.totalPaid)    AS totalPaidFormatted,
        fn_format_cop(fs.totalPending) AS totalPendingFormatted,
        fn_format_cop(fs.budgetPC)     AS budgetFormatted
    FROM v_financial_summary fs
    WHERE fs.projectId = p_project_id;

    -- Pagos en el rango
    SELECT
        pd.paymentNumber,
        pd.concept,
        pd.amount,
        pd.amountFormatted,
        pd.paymentType,
        pd.statusLabel,
        pd.contractorName,
        pd.paidAt,
        pd.createdAt
    FROM v_payment_dashboard pd
    WHERE pd.projectId = p_project_id
        AND (
            (p_start_date IS NULL OR DATE(pd.createdAt) >= p_start_date)
            AND (p_end_date IS NULL OR DATE(pd.createdAt) <= p_end_date)
        )
    ORDER BY pd.createdAt DESC;

    -- Resumen por tipo de pago
    SELECT
        paymentType,
        COUNT(*) AS cantidad,
        SUM(amount) AS total,
        fn_format_cop(SUM(amount)) AS totalFormatted
    FROM PaymentRequest
    WHERE projectId = p_project_id
        AND status = 'PAID'
        AND (p_start_date IS NULL OR DATE(createdAt) >= p_start_date)
        AND (p_end_date IS NULL OR DATE(createdAt) <= p_end_date)
    GROUP BY paymentType;

    -- Cortes aprobados en el rango
    SELECT
        wcs.cutNumber,
        wcs.periodStart,
        wcs.periodEnd,
        wcs.requestedAmountFormatted,
        wcs.contractorName,
        wcs.approvedAt,
        wcs.paymentStatusLabel
    FROM v_work_cut_summary wcs
    WHERE wcs.projectId = p_project_id
        AND wcs.statusLabel = 'Aprobado'
        AND (p_start_date IS NULL OR DATE(wcs.approvedAt) >= p_start_date)
        AND (p_end_date IS NULL OR DATE(wcs.approvedAt) <= p_end_date)
    ORDER BY wcs.approvedAt DESC;
END$$
DELIMITER ;


-- =============================================
-- sp_check_expiring_documents
-- Devuelve todos los documentos próximos a vencer o vencidos
-- (para dashboard de alertas)
-- =============================================
DROP PROCEDURE IF EXISTS sp_check_expiring_documents;

DELIMITER $$
CREATE PROCEDURE sp_check_expiring_documents(IN p_days_warning INT)
BEGIN
    -- Documentos de subcontratistas
    SELECT
        'SUBCONTRATISTA'    AS entityType,
        c.id                AS entityId,
        c.name              AS entityName,
        d.type              AS docType,
        d.expirationDate,
        fn_days_until(DATE(d.expirationDate)) AS daysUntilExpiry,
        fn_doc_expired(DATE(d.expirationDate)) AS isExpired
    FROM Contractor c
    JOIN Document d ON d.contractorId = c.id
    WHERE d.expirationDate IS NOT NULL
        AND (fn_doc_expired(DATE(d.expirationDate)) = 1
             OR fn_days_until(DATE(d.expirationDate)) <= IFNULL(p_days_warning, 30))

    UNION ALL

    -- Documentos de empleados
    SELECT
        'EMPLEADO'          AS entityType,
        e.id                AS entityId,
        COALESCE(u.name, e.employeeNumber) AS entityName,
        ed.type             AS docType,
        ed.expirationDate,
        fn_days_until(DATE(ed.expirationDate)) AS daysUntilExpiry,
        fn_doc_expired(DATE(ed.expirationDate)) AS isExpired
    FROM Employee e
    LEFT JOIN User u ON u.id = e.userId
    JOIN EmployeeDocument ed ON ed.employeeId = e.id
    WHERE ed.expirationDate IS NOT NULL
        AND (fn_doc_expired(DATE(ed.expirationDate)) = 1
             OR fn_days_until(DATE(ed.expirationDate)) <= IFNULL(p_days_warning, 30))

    UNION ALL

    -- Documentos de proveedores
    SELECT
        'PROVEEDOR'         AS entityType,
        s.id                AS entityId,
        s.name              AS entityName,
        sd.type             AS docType,
        sd.expirationDate,
        fn_days_until(DATE(sd.expirationDate)) AS daysUntilExpiry,
        fn_doc_expired(DATE(sd.expirationDate)) AS isExpired
    FROM Supplier s
    JOIN SupplierDocument sd ON sd.supplierId = s.id
    WHERE sd.expirationDate IS NOT NULL
        AND (fn_doc_expired(DATE(sd.expirationDate)) = 1
             OR fn_days_until(DATE(sd.expirationDate)) <= IFNULL(p_days_warning, 30))

    ORDER BY daysUntilExpiry ASC;
END$$
DELIMITER ;


-- =============================================
-- sp_update_contractor_status
-- Recalcula y actualiza el status de un subcontratista
-- basado en sus documentos actuales
-- =============================================
DROP PROCEDURE IF EXISTS sp_update_contractor_status;

DELIMITER $$
CREATE PROCEDURE sp_update_contractor_status(IN p_contractor_id VARCHAR(25))
BEGIN
    DECLARE v_docs_count INT;
    DECLARE v_expired_count INT;

    SELECT
        COUNT(DISTINCT type),
        SUM(fn_doc_expired(DATE(expirationDate)))
    INTO v_docs_count, v_expired_count
    FROM Document
    WHERE contractorId = p_contractor_id
        AND (expirationDate IS NULL OR expirationDate >= CURDATE());

    UPDATE Contractor SET
        status = CASE
            WHEN v_expired_count > 0    THEN 'EXPIRED'
            WHEN v_docs_count >= 4      THEN 'COMPLETE'
            ELSE                             'INCOMPLETE'
        END,
        updatedAt = NOW()
    WHERE id = p_contractor_id;
END$$
DELIMITER ;
