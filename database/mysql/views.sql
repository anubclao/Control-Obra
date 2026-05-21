-- =============================================
-- CONTROL DE OBRA - MySQL Views
-- =============================================
-- Requiere que las funciones de functions.sql estén creadas
-- Los nombres de tabla corresponden al mapeo de Prisma (PascalCase → tabla)

USE control_obra_db;


-- =============================================
-- v_project_summary
-- Resumen de proyectos con presupuesto, pagos y subcontratistas
-- =============================================
CREATE OR REPLACE VIEW v_project_summary AS
SELECT
    p.id                                        AS projectId,
    p.code                                      AS projectCode,
    p.name                                      AS projectName,
    p.client,
    p.location,
    p.status,
    fn_project_status_label(p.status)           AS statusLabel,
    p.startDate,
    p.estimatedEndDate,
    p.totalBudget,
    fn_format_cop(p.totalBudget)                AS totalBudgetFormatted,
    fn_days_until(DATE(p.estimatedEndDate))     AS daysUntilEnd,
    -- Presupuesto
    COALESCE(b.totalPC, 0)                      AS budgetTotalPC,
    COALESCE(b.totalPT, 0)                      AS budgetTotalPT,
    COALESCE(b.totalDirectCostPC, 0)            AS budgetDirectCostPC,
    -- Pagos
    COALESCE(pag_stats.totalPaid, 0)            AS totalPaid,
    COALESCE(pag_stats.totalPending, 0)         AS totalPending,
    COALESCE(pag_stats.countPaid, 0)            AS paymentsCount,
    -- Cortes
    COALESCE(cut_stats.totalCuts, 0)            AS totalCuts,
    COALESCE(cut_stats.approvedCuts, 0)         AS approvedCuts,
    COALESCE(cut_stats.pendingCuts, 0)          AS pendingCuts,
    -- Subcontratistas
    COALESCE(cnt_stats.contractorCount, 0)      AS contractorCount,
    -- Ejecución
    CASE
        WHEN COALESCE(b.totalPC, 0) = 0 THEN 0
        ELSE ROUND((COALESCE(pag_stats.totalPaid, 0) / b.totalPC) * 100, 2)
    END                                         AS executionPct
FROM Project p
LEFT JOIN Budget b ON b.projectId = p.id
LEFT JOIN (
    SELECT
        projectId,
        SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END)     AS totalPaid,
        SUM(CASE WHEN status IN ('PENDING','APPROVED_LEVEL_1',
            'APPROVED_LEVEL_2','APPROVED') THEN amount ELSE 0 END) AS totalPending,
        COUNT(CASE WHEN status = 'PAID' THEN 1 END)                AS countPaid
    FROM PaymentRequest
    GROUP BY projectId
) pag_stats ON pag_stats.projectId = p.id
LEFT JOIN (
    SELECT
        projectId,
        COUNT(*) AS totalCuts,
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) AS approvedCuts,
        SUM(CASE WHEN status IN ('PENDING','IN_REVIEW') THEN 1 ELSE 0 END) AS pendingCuts
    FROM WorkCut
    GROUP BY projectId
) cut_stats ON cut_stats.projectId = p.id
LEFT JOIN (
    SELECT projectId, COUNT(DISTINCT contractorId) AS contractorCount
    FROM WorkCut
    GROUP BY projectId
) cnt_stats ON cnt_stats.projectId = p.id;


-- =============================================
-- v_budget_progress
-- Ítems de presupuesto con avance acumulado y rentabilidad
-- =============================================
CREATE OR REPLACE VIEW v_budget_progress AS
SELECT
    bi.id                                       AS itemId,
    bi.itemNumber,
    bi.description                              AS itemDescription,
    bi.unit,
    bi.quantity                                 AS totalQuantity,
    bi.unitPricePC,
    bi.unitPricePT,
    bi.totalPC,
    bi.totalPT,
    bi.status                                   AS profitStatus,
    fn_budget_item_status(bi.totalPC, bi.totalPT) AS profitStatusCalc,
    -- Capa
    bl.code                                     AS layerCode,
    bl.name                                     AS layerName,
    -- Proyecto (a través de la capa y presupuesto)
    b.projectId,
    -- Avance
    COALESCE(prog.executedQty, 0)              AS executedQuantity,
    CASE
        WHEN bi.quantity = 0 THEN 0
        ELSE ROUND((COALESCE(prog.executedQty, 0) / bi.quantity) * 100, 2)
    END                                         AS progressPct,
    COALESCE(prog.executedQty, 0) * bi.unitPricePC AS executedValuePC,
    COALESCE(prog.executedQty, 0) * bi.unitPricePT AS executedValuePT
FROM BudgetItem bi
JOIN BudgetLayer bl  ON bl.id = bi.layerId
JOIN Budget b        ON b.id  = bl.budgetId
LEFT JOIN (
    SELECT budgetItemId, SUM(quantityToday) AS executedQty
    FROM ProgressEntry
    WHERE status = 'APPROVED'
    GROUP BY budgetItemId
) prog ON prog.budgetItemId = bi.id;


-- =============================================
-- v_payment_dashboard
-- Pagos con información completa para panel de control
-- =============================================
CREATE OR REPLACE VIEW v_payment_dashboard AS
SELECT
    pr.id                                       AS paymentId,
    pr.paymentNumber,
    pr.concept,
    pr.amount,
    fn_format_cop(pr.amount)                    AS amountFormatted,
    pr.currency,
    pr.paymentType,
    pr.priority,
    pr.status,
    fn_payment_status_label(pr.status)          AS statusLabel,
    pr.currentApprovalLevel,
    pr.requiredApprovalLevel,
    pr.dueDate,
    fn_days_until(DATE(pr.dueDate))             AS daysUntilDue,
    pr.paidAt,
    pr.createdAt,
    -- Proyecto
    p.id                                        AS projectId,
    p.name                                      AS projectName,
    p.code                                      AS projectCode,
    -- Subcontratista
    c.id                                        AS contractorId,
    c.name                                      AS contractorName,
    c.nit                                       AS contractorNit,
    -- Beneficiario alternativo
    pr.beneficiaryName,
    pr.beneficiaryNit,
    pr.bankName,
    pr.accountType,
    -- Creador
    u.name                                      AS createdByName,
    pr.createdById,
    -- Corte relacionado
    pr.workCutId,
    wc.cutNumber                                AS workCutNumber,
    -- Contrato relacionado
    pr.contractId,
    ct.contractNumber,
    -- Última aprobación
    last_ap.approverName                        AS lastApproverName,
    last_ap.approvedAt                          AS lastApprovalAt
FROM PaymentRequest pr
JOIN Project p ON p.id = pr.projectId
LEFT JOIN Contractor c ON c.id = pr.contractorId
LEFT JOIN User u ON u.id = pr.createdById
LEFT JOIN WorkCut wc ON wc.id = pr.workCutId
LEFT JOIN Contract ct ON ct.id = pr.contractId
LEFT JOIN (
    SELECT
        pa.paymentRequestId,
        u2.name AS approverName,
        pa.createdAt AS approvedAt,
        ROW_NUMBER() OVER (PARTITION BY pa.paymentRequestId ORDER BY pa.createdAt DESC) AS rn
    FROM PaymentApproval pa
    JOIN User u2 ON u2.id = pa.approverId
) last_ap ON last_ap.paymentRequestId = pr.id AND last_ap.rn = 1;


-- =============================================
-- v_contractor_doc_status
-- Subcontratistas con estado de documentación
-- =============================================
CREATE OR REPLACE VIEW v_contractor_doc_status AS
SELECT
    c.id                                        AS contractorId,
    c.name,
    c.nit,
    c.status,
    c.city,
    -- Documentos requeridos: CEDULA, RUT, CAMARA_COMERCIO, CERTIFICADO_BANCARIO
    MAX(CASE WHEN d.type = 'CEDULA' AND fn_doc_expired(DATE(d.expirationDate)) = 0 THEN 1 ELSE 0 END) AS hasCedula,
    MAX(CASE WHEN d.type = 'RUT' AND fn_doc_expired(DATE(d.expirationDate)) = 0 THEN 1 ELSE 0 END)    AS hasRut,
    MAX(CASE WHEN d.type = 'CAMARA_COMERCIO' AND fn_doc_expired(DATE(d.expirationDate)) = 0 THEN 1 ELSE 0 END) AS hasCamara,
    MAX(CASE WHEN d.type = 'CERTIFICADO_BANCARIO' AND fn_doc_expired(DATE(d.expirationDate)) = 0 THEN 1 ELSE 0 END) AS hasCertBancario,
    -- % de completitud (sobre 4 documentos requeridos)
    ROUND(
        (MAX(CASE WHEN d.type = 'CEDULA' AND fn_doc_expired(DATE(d.expirationDate)) = 0 THEN 1 ELSE 0 END)
        + MAX(CASE WHEN d.type = 'RUT' AND fn_doc_expired(DATE(d.expirationDate)) = 0 THEN 1 ELSE 0 END)
        + MAX(CASE WHEN d.type = 'CAMARA_COMERCIO' AND fn_doc_expired(DATE(d.expirationDate)) = 0 THEN 1 ELSE 0 END)
        + MAX(CASE WHEN d.type = 'CERTIFICADO_BANCARIO' AND fn_doc_expired(DATE(d.expirationDate)) = 0 THEN 1 ELSE 0 END)
        ) / 4 * 100, 0
    )                                           AS docCompletePct,
    -- Documentos próximos a vencer (30 días)
    SUM(CASE WHEN d.expirationDate IS NOT NULL AND fn_doc_expires_soon(DATE(d.expirationDate), 30) = 1 THEN 1 ELSE 0 END) AS docExpiringSoon,
    -- Documentos vencidos
    SUM(CASE WHEN fn_doc_expired(DATE(d.expirationDate)) = 1 THEN 1 ELSE 0 END) AS docExpired,
    COUNT(d.id)                                 AS totalDocs
FROM Contractor c
LEFT JOIN Document d ON d.contractorId = c.id
GROUP BY c.id, c.name, c.nit, c.status, c.city;


-- =============================================
-- v_work_cut_summary
-- Cortes de obra con estado de pago asociado
-- =============================================
CREATE OR REPLACE VIEW v_work_cut_summary AS
SELECT
    wc.id                                       AS cutId,
    wc.cutNumber,
    wc.periodStart,
    wc.periodEnd,
    wc.requestedAmount,
    fn_format_cop(wc.requestedAmount)           AS requestedAmountFormatted,
    wc.status,
    fn_work_cut_status_label(wc.status)         AS statusLabel,
    wc.createdAt,
    wc.approvedAt,
    -- Proyecto
    p.id                                        AS projectId,
    p.name                                      AS projectName,
    p.code                                      AS projectCode,
    -- Subcontratista
    c.id                                        AS contractorId,
    c.name                                      AS contractorName,
    -- Centro de costo
    cc.name                                     AS costCenterName,
    -- Aprobador
    u.name                                      AS approvedByName,
    -- Pago relacionado
    pr.id                                       AS paymentRequestId,
    pr.paymentNumber,
    pr.status                                   AS paymentStatus,
    fn_payment_status_label(pr.status)          AS paymentStatusLabel,
    pr.amount                                   AS paymentAmount
FROM WorkCut wc
JOIN Project p    ON p.id  = wc.projectId
JOIN Contractor c ON c.id  = wc.contractorId
JOIN CostCenter cc ON cc.id = wc.costCenterId
LEFT JOIN User u  ON u.id  = wc.approvedById
LEFT JOIN PaymentRequest pr ON pr.workCutId = wc.id AND pr.status != 'CANCELLED';


-- =============================================
-- v_employee_doc_expiry
-- Empleados con documentos próximos a vencer o vencidos
-- =============================================
CREATE OR REPLACE VIEW v_employee_doc_expiry AS
SELECT
    e.id                                        AS employeeId,
    e.employeeNumber,
    u.name                                      AS employeeName,
    u.email                                     AS employeeEmail,
    e.position,
    e.department,
    e.status                                    AS employeeStatus,
    ed.id                                       AS docId,
    ed.type                                     AS docType,
    ed.fileName,
    ed.expirationDate,
    fn_days_until(DATE(ed.expirationDate))      AS daysUntilExpiry,
    fn_doc_expired(DATE(ed.expirationDate))     AS isExpired,
    fn_doc_expires_soon(DATE(ed.expirationDate), 30) AS expiresSoon30,
    fn_doc_expires_soon(DATE(ed.expirationDate), 60) AS expiresSoon60
FROM Employee e
LEFT JOIN User u ON u.id = e.userId
JOIN EmployeeDocument ed ON ed.employeeId = e.id
WHERE ed.expirationDate IS NOT NULL
    AND (fn_doc_expired(DATE(ed.expirationDate)) = 1
         OR fn_doc_expires_soon(DATE(ed.expirationDate), 60) = 1);


-- =============================================
-- v_financial_summary
-- Resumen financiero por proyecto
-- =============================================
CREATE OR REPLACE VIEW v_financial_summary AS
SELECT
    p.id                                        AS projectId,
    p.code                                      AS projectCode,
    p.name                                      AS projectName,
    p.status,
    p.startDate,
    p.estimatedEndDate,
    -- Presupuesto
    COALESCE(b.totalPC, 0)                      AS budgetPC,
    COALESCE(b.totalPT, 0)                      AS budgetPT,
    COALESCE(b.totalDirectCostPC, 0)            AS directCostPC,
    COALESCE(b.totalAIU_PC, 0)                  AS aiuPC,
    COALESCE(b.totalIvaUtilidad_PC, 0)          AS ivaPC,
    -- Pagos por estado
    COALESCE(SUM(CASE WHEN pr.status = 'PAID' THEN pr.amount ELSE 0 END), 0) AS totalPaid,
    COALESCE(SUM(CASE WHEN pr.status = 'APPROVED' THEN pr.amount ELSE 0 END), 0) AS totalApproved,
    COALESCE(SUM(CASE WHEN pr.status IN ('PENDING','APPROVED_LEVEL_1','APPROVED_LEVEL_2') THEN pr.amount ELSE 0 END), 0) AS totalPending,
    COALESCE(SUM(CASE WHEN pr.status = 'REJECTED' THEN pr.amount ELSE 0 END), 0) AS totalRejected,
    -- Pagos por tipo
    COALESCE(SUM(CASE WHEN pr.paymentType = 'ANTICIPO' THEN pr.amount ELSE 0 END), 0) AS totalAnticipos,
    COALESCE(SUM(CASE WHEN pr.paymentType = 'CORTE_OBRA' THEN pr.amount ELSE 0 END), 0) AS totalCortes,
    COALESCE(SUM(CASE WHEN pr.paymentType = 'SUMINISTRO' THEN pr.amount ELSE 0 END), 0) AS totalSuministros,
    -- Saldo disponible
    COALESCE(b.totalPC, 0) - COALESCE(SUM(CASE WHEN pr.status IN ('PAID','APPROVED') THEN pr.amount ELSE 0 END), 0) AS saldoDisponible,
    -- % ejecución financiera
    CASE
        WHEN COALESCE(b.totalPC, 0) = 0 THEN 0
        ELSE ROUND(
            COALESCE(SUM(CASE WHEN pr.status = 'PAID' THEN pr.amount ELSE 0 END), 0)
            / b.totalPC * 100, 2
        )
    END AS executionPct
FROM Project p
LEFT JOIN Budget b ON b.projectId = p.id
LEFT JOIN PaymentRequest pr ON pr.projectId = p.id
GROUP BY p.id, p.code, p.name, p.status, p.startDate, p.estimatedEndDate,
         b.totalPC, b.totalPT, b.totalDirectCostPC, b.totalAIU_PC, b.totalIvaUtilidad_PC;


-- =============================================
-- v_quotation_pipeline
-- Pipeline de ventas con cotizaciones por estado
-- =============================================
CREATE OR REPLACE VIEW v_quotation_pipeline AS
SELECT
    q.id                                        AS quotationId,
    q.quotationNumber,
    q.title,
    q.status,
    q.validUntil,
    fn_days_until(DATE(q.validUntil))           AS daysUntilExpiry,
    q.subtotal,
    q.discountAmount,
    q.ivaAmount,
    q.total,
    fn_format_cop(q.total)                      AS totalFormatted,
    q.createdAt,
    q.sentAt,
    -- Cliente
    c.id                                        AS clientId,
    c.clientNumber,
    c.companyName                               AS clientName,
    c.contactName,
    c.email                                     AS clientEmail,
    c.city                                      AS clientCity,
    c.status                                    AS clientStatus,
    -- Items
    COALESCE(item_stats.itemCount, 0)           AS itemCount
FROM Quotation q
JOIN Client c ON c.id = q.clientId
LEFT JOIN (
    SELECT quotationId, COUNT(*) AS itemCount
    FROM QuotationItem
    GROUP BY quotationId
) item_stats ON item_stats.quotationId = q.id;


-- =============================================
-- v_supplier_doc_status
-- Proveedores con estado de documentación
-- =============================================
CREATE OR REPLACE VIEW v_supplier_doc_status AS
SELECT
    s.id                                        AS supplierId,
    s.name,
    s.nit,
    s.status,
    s.category,
    s.city,
    MAX(CASE WHEN sd.type = 'CEDULA' AND fn_doc_expired(DATE(sd.expirationDate)) = 0 THEN 1 ELSE 0 END) AS hasCedula,
    MAX(CASE WHEN sd.type = 'RUT' AND fn_doc_expired(DATE(sd.expirationDate)) = 0 THEN 1 ELSE 0 END) AS hasRut,
    MAX(CASE WHEN sd.type = 'CAMARA_COMERCIO' AND fn_doc_expired(DATE(sd.expirationDate)) = 0 THEN 1 ELSE 0 END) AS hasCamara,
    MAX(CASE WHEN sd.type = 'CERTIFICADO_BANCARIO' AND fn_doc_expired(DATE(sd.expirationDate)) = 0 THEN 1 ELSE 0 END) AS hasCertBancario,
    ROUND(
        (MAX(CASE WHEN sd.type = 'CEDULA' THEN 1 ELSE 0 END)
        + MAX(CASE WHEN sd.type = 'RUT' THEN 1 ELSE 0 END)
        + MAX(CASE WHEN sd.type = 'CAMARA_COMERCIO' THEN 1 ELSE 0 END)
        + MAX(CASE WHEN sd.type = 'CERTIFICADO_BANCARIO' THEN 1 ELSE 0 END)
        ) / 4 * 100, 0
    )                                           AS docCompletePct,
    COUNT(sd.id)                                AS totalDocs
FROM Supplier s
LEFT JOIN SupplierDocument sd ON sd.supplierId = s.id
GROUP BY s.id, s.name, s.nit, s.status, s.category, s.city;
