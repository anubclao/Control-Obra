-- =============================================================================
-- 000i — Verificación final SIN information_schema (compatible con Hostinger)
-- =============================================================================
-- Reemplaza 000b_definitivo_verificacion.sql para entornos donde el
-- usuario MySQL no tiene acceso a information_schema.
-- Usa SHOW CREATE TABLE (que sí funciona con permisos limitados).
-- =============================================================================

-- 1) aiu_configs: ¿tiene chk_aiu_range? ¿tiene chk_aiu_sum?
SHOW CREATE TABLE aiu_configs\G

-- 2) document_generation_log
SHOW CREATE TABLE document_generation_log\G

-- 3) budget_change_orders
SHOW CREATE TABLE budget_change_orders\G

-- 4) budget_change_order_items
SHOW CREATE TABLE budget_change_order_items\G

-- 5) users: ¿tiene la columna status?
SHOW COLUMNS FROM users LIKE 'status';

-- 6) contracts: ¿tiene pricing_mode?
SHOW COLUMNS FROM contracts LIKE 'pricing_mode';

-- 7) budgets: ¿tiene change_order_seq y los 4 de la 004?
SHOW COLUMNS FROM budgets LIKE 'change_order_seq';
SHOW COLUMNS FROM budgets LIKE 'payment_terms_json';
SHOW COLUMNS FROM budgets LIKE 'delivery_days';
SHOW COLUMNS FROM budgets LIKE 'offer_validity_days';
SHOW COLUMNS FROM budgets LIKE 'commercial_advisor_json';
