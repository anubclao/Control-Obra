-- =============================================
-- CONTROL DE OBRA - MySQL Functions
-- =============================================
-- Ejecutar después de crear las tablas (Prisma migrate)
-- Requiere MySQL 8.0+

USE control_obra_db;

-- =============================================
-- fn_format_cop: Formatea un número como pesos colombianos
-- Ejemplo: fn_format_cop(1500000) => '$ 1.500.000'
-- =============================================
DROP FUNCTION IF EXISTS fn_format_cop;

DELIMITER $$
CREATE FUNCTION fn_format_cop(p_amount DECIMAL(20,2))
RETURNS VARCHAR(50)
DETERMINISTIC
BEGIN
    DECLARE v_int_part BIGINT;
    DECLARE v_formatted VARCHAR(50);
    DECLARE v_length INT;
    DECLARE v_pos INT;
    DECLARE v_result VARCHAR(50) DEFAULT '';
    DECLARE v_digit CHAR(1);

    SET v_int_part = FLOOR(p_amount);
    SET v_formatted = CAST(v_int_part AS CHAR);
    SET v_length = LENGTH(v_formatted);
    SET v_pos = 1;

    WHILE v_pos <= v_length DO
        SET v_digit = SUBSTRING(v_formatted, v_pos, 1);
        IF v_pos > 1 AND MOD(v_length - v_pos + 1, 3) = 0 THEN
            SET v_result = CONCAT(v_result, '.');
        END IF;
        SET v_result = CONCAT(v_result, v_digit);
        SET v_pos = v_pos + 1;
    END WHILE;

    RETURN CONCAT('$ ', v_result);
END$$
DELIMITER ;


-- =============================================
-- fn_days_until: Días hasta una fecha (negativo si ya pasó)
-- Ejemplo: fn_days_until('2026-12-31') => 248
-- =============================================
DROP FUNCTION IF EXISTS fn_days_until;

DELIMITER $$
CREATE FUNCTION fn_days_until(p_date DATE)
RETURNS INT
DETERMINISTIC
BEGIN
    RETURN DATEDIFF(p_date, CURDATE());
END$$
DELIMITER ;


-- =============================================
-- fn_doc_expired: 1 si el documento está vencido, 0 si está vigente
-- Ejemplo: fn_doc_expired('2025-01-01') => 1
-- =============================================
DROP FUNCTION IF EXISTS fn_doc_expired;

DELIMITER $$
CREATE FUNCTION fn_doc_expired(p_expiration_date DATE)
RETURNS TINYINT
DETERMINISTIC
BEGIN
    IF p_expiration_date IS NULL THEN
        RETURN 0;
    END IF;
    RETURN IF(p_expiration_date < CURDATE(), 1, 0);
END$$
DELIMITER ;


-- =============================================
-- fn_doc_expires_soon: 1 si vence en los próximos N días
-- Ejemplo: fn_doc_expires_soon('2026-05-15', 30) => 1
-- =============================================
DROP FUNCTION IF EXISTS fn_doc_expires_soon;

DELIMITER $$
CREATE FUNCTION fn_doc_expires_soon(p_expiration_date DATE, p_days INT)
RETURNS TINYINT
DETERMINISTIC
BEGIN
    IF p_expiration_date IS NULL THEN
        RETURN 0;
    END IF;
    RETURN IF(
        p_expiration_date >= CURDATE() AND p_expiration_date <= DATE_ADD(CURDATE(), INTERVAL p_days DAY),
        1, 0
    );
END$$
DELIMITER ;


-- =============================================
-- fn_calc_aiu: Calcula el total de AIU sobre un costo directo
-- Parámetros: costo directo, % admin, % imprevistos, % utilidad, % IVA sobre utilidad
-- Retorna: monto total de AIU (sin incluir el costo directo)
-- =============================================
DROP FUNCTION IF EXISTS fn_calc_aiu;

DELIMITER $$
CREATE FUNCTION fn_calc_aiu(
    p_direct_cost     DECIMAL(20,2),
    p_admin_pct       DECIMAL(5,2),
    p_imprev_pct      DECIMAL(5,2),
    p_utilidad_pct    DECIMAL(5,2),
    p_iva_utilidad_pct DECIMAL(5,2)
)
RETURNS DECIMAL(20,2)
DETERMINISTIC
BEGIN
    DECLARE v_admin       DECIMAL(20,2);
    DECLARE v_imprev      DECIMAL(20,2);
    DECLARE v_utilidad    DECIMAL(20,2);
    DECLARE v_iva_util    DECIMAL(20,2);

    SET v_admin    = p_direct_cost * (p_admin_pct / 100);
    SET v_imprev   = p_direct_cost * (p_imprev_pct / 100);
    SET v_utilidad = p_direct_cost * (p_utilidad_pct / 100);
    SET v_iva_util = v_utilidad * (p_iva_utilidad_pct / 100);

    RETURN v_admin + v_imprev + v_utilidad + v_iva_util;
END$$
DELIMITER ;


-- =============================================
-- fn_payment_status_label: Etiqueta en español para estado de pago
-- =============================================
DROP FUNCTION IF EXISTS fn_payment_status_label;

DELIMITER $$
CREATE FUNCTION fn_payment_status_label(p_status VARCHAR(30))
RETURNS VARCHAR(50)
DETERMINISTIC
BEGIN
    RETURN CASE p_status
        WHEN 'PENDING'          THEN 'Pendiente'
        WHEN 'APPROVED_LEVEL_1' THEN 'Aprobado por Director'
        WHEN 'APPROVED_LEVEL_2' THEN 'Aprobado por Gerencia'
        WHEN 'APPROVED'         THEN 'Completamente Aprobado'
        WHEN 'REJECTED'         THEN 'Rechazado'
        WHEN 'PAID'             THEN 'Pagado'
        WHEN 'CANCELLED'        THEN 'Cancelado'
        ELSE p_status
    END;
END$$
DELIMITER ;


-- =============================================
-- fn_project_status_label: Etiqueta en español para estado de proyecto
-- =============================================
DROP FUNCTION IF EXISTS fn_project_status_label;

DELIMITER $$
CREATE FUNCTION fn_project_status_label(p_status VARCHAR(30))
RETURNS VARCHAR(50)
DETERMINISTIC
BEGIN
    RETURN CASE p_status
        WHEN 'IN_PLANNING'  THEN 'En Planeación'
        WHEN 'IN_EXECUTION' THEN 'En Ejecución'
        WHEN 'PAUSED'       THEN 'Pausado'
        WHEN 'COMPLETED'    THEN 'Completado'
        ELSE p_status
    END;
END$$
DELIMITER ;


-- =============================================
-- fn_work_cut_status_label: Etiqueta para estado de corte
-- =============================================
DROP FUNCTION IF EXISTS fn_work_cut_status_label;

DELIMITER $$
CREATE FUNCTION fn_work_cut_status_label(p_status VARCHAR(30))
RETURNS VARCHAR(50)
DETERMINISTIC
BEGIN
    RETURN CASE p_status
        WHEN 'PENDING'   THEN 'Pendiente'
        WHEN 'IN_REVIEW' THEN 'En Revisión'
        WHEN 'APPROVED'  THEN 'Aprobado'
        WHEN 'REJECTED'  THEN 'Rechazado'
        ELSE p_status
    END;
END$$
DELIMITER ;


-- =============================================
-- fn_budget_item_status: Estado de rentabilidad de un ítem
-- GREEN=rentable, YELLOW=riesgo leve, RED=pérdida
-- =============================================
DROP FUNCTION IF EXISTS fn_budget_item_status;

DELIMITER $$
CREATE FUNCTION fn_budget_item_status(p_pc DECIMAL(20,2), p_pt DECIMAL(20,2))
RETURNS VARCHAR(10)
DETERMINISTIC
BEGIN
    DECLARE v_diff_pct DECIMAL(5,2);
    IF p_pt = 0 THEN RETURN 'GREEN'; END IF;
    SET v_diff_pct = ((p_pt - p_pc) / p_pt) * 100;
    RETURN CASE
        WHEN p_pc >= p_pt       THEN 'GREEN'
        WHEN v_diff_pct < 10    THEN 'YELLOW'
        ELSE                         'RED'
    END;
END$$
DELIMITER ;
