-- =============================================================================
-- 000j — Verificación final SIN information_schema, sin \G
-- =============================================================================
-- 000i usaba \G que phpMyAdmin se comía. Esta versión usa ; normal
-- y exporta el resultado en columnas más angostas para que se vea entero.
-- =============================================================================

-- 1) aiu_configs
SELECT 'aiu_configs' AS tabla,
       IF(LOCATE('chk_aiu_range', @@global.general_log) > 0, '?', '?') AS chk_aiu_range_en_log;
SHOW CREATE TABLE aiu_configs;

-- 2) document_generation_log
SHOW CREATE TABLE document_generation_log;

-- 3) budget_change_orders
SHOW CREATE TABLE budget_change_orders;

-- 4) budget_change_order_items
SHOW CREATE TABLE budget_change_order_items;

-- 5) Columnas críticas
SHOW COLUMNS FROM users LIKE 'status';
SHOW COLUMNS FROM users LIKE 'project_id';
SHOW COLUMNS FROM users LIKE 'authorized_by';
SHOW COLUMNS FROM contracts LIKE 'pricing_mode';
SHOW COLUMNS FROM budgets LIKE 'change_order_seq';
SHOW COLUMNS FROM budgets LIKE 'payment_terms_json';
SHOW COLUMNS FROM budgets LIKE 'delivery_days';
SHOW COLUMNS FROM budgets LIKE 'offer_validity_days';
SHOW COLUMNS FROM budgets LIKE 'commercial_advisor_json';
SHOW COLUMNS FROM payment_requests LIKE 'generated_document_url';
SHOW COLUMNS FROM expenses LIKE 'generated_document_url';
SHOW COLUMNS FROM work_cuts LIKE 'generated_document_url';
SHOW COLUMNS FROM contracts LIKE 'generated_document_url';
SHOW COLUMNS FROM employees LIKE 'generated_document_url';
SHOW COLUMNS FROM work_logs LIKE 'generated_document_url';
