-- =============================================================================
-- ControlObra — PARTE 2/2: Verificación + auditoría AIU viejo
-- =============================================================================
-- Ejecutar DESPUÉS de 000a_definitivo_sin_proc.sql.
-- Solo lectura: NO modifica nada, solo reporta.
-- En phpMyAdmin: BD activa → SQL → pegar → Continuar.
-- =============================================================================

-- =============================================================================
-- A) Auditoría: AIU con suma > 40 (vestigios de la regla vieja A+I+U=100)
--    Lista los project_id que hay que reconfigurar en la UI.
--    (Si no devuelve filas, todo OK.)
-- =============================================================================
SELECT project_id,
       administration  AS A,
       imprevistos    AS I,
       utilidad       AS U,
       administration + imprevistos + utilidad AS aiu_total
  FROM aiu_configs
 WHERE administration + imprevistos + utilidad > 40
 ORDER BY aiu_total DESC;

-- =============================================================================
-- B) Conteo de tablas/columnas/constraints esperados
--    (debe devolver: status=1, pricing_mode=1, doc_log=1, bco=1, bcoi=1,
--     chk_aiu_range=1, chk_aiu_sum=0, change_order_seq=1, all_generated_url=1)
-- =============================================================================
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'status')
    AS users_status,
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'contracts' AND column_name = 'pricing_mode')
    AS contracts_pricing_mode,
  (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'document_generation_log')
    AS document_generation_log,
  (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'budget_change_orders')
    AS budget_change_orders,
  (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'budget_change_order_items')
    AS budget_change_order_items,
  (SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'aiu_configs' AND constraint_name = 'chk_aiu_range')
    AS chk_aiu_range,
  (SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'aiu_configs' AND constraint_name = 'chk_aiu_sum')
    AS chk_aiu_sum_vieja,
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'budgets' AND column_name = 'change_order_seq')
    AS budgets_change_order_seq;

-- =============================================================================
-- C) Auditoría: cuentas ADMIN sospechosas
--    (Opcional, ejecutar aparte. Está acá para tenerlo a mano.)
-- =============================================================================
-- SELECT id, email, name, is_active, status, last_login_at, created_at
--   FROM users
--  WHERE role = 'ADMIN'
--  ORDER BY created_at DESC;

-- =============================================================================
-- D) Auditoría: ¿quedó el constraint viejo de AIU? (debe ser 0)
-- =============================================================================
SELECT constraint_name
  FROM information_schema.table_constraints
 WHERE table_schema = DATABASE()
   AND table_name   = 'aiu_configs'
   AND constraint_name IN ('chk_aiu_sum', 'chk_aiu_range')
 ORDER BY constraint_name;

-- =============================================================================
-- E) generated_document_url en las 6 entidades
-- =============================================================================
SELECT table_name, column_name
  FROM information_schema.columns
 WHERE table_schema = DATABASE()
   AND column_name = 'generated_document_url'
 ORDER BY table_name;
