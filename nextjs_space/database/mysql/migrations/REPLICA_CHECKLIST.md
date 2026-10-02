# Checklist de réplica — ControlObra BD en Hostinger

> Después de correr [`000_replica_hostinger.sql`](000_replica_hostinger.sql), usá este checklist
> para confirmar que la BD quedó 100 % alineada con el código.

**Cómo correr cada check:** phpMyAdmin → seleccionar la BD → pestaña SQL → pegar el SQL → Continuar.

---

## ✅ Check 1 — `users` (migración 002)

```sql
SHOW COLUMNS FROM users;
```

**Esperado:** tiene que haber una columna `status` (ENUM con default `ACTIVE`) **después** de `area`, y también `project_id`, `created_by`, `authorized_by`, `authorized_at`, `suspended_by`, `suspended_at`.

---

## ✅ Check 2 — Accounting (migración 003)

```sql
SHOW TABLES LIKE 'accounting_%';
```

**Esperado:** 3+ filas (`accounting_accounts`, `accounting_incomes`, `accounting_expenses` mínimo; `accounting_tax_movements` y `accounting_retefuente_movements` se crean con `init.sql` si corriste ese primero).

---

## ✅ Check 3 — `budgets` con condiciones comerciales + CC (migraciones 004 + 009)

```sql
SHOW COLUMNS FROM budgets;
```

**Esperado:** tiene que haber 5 columnas nuevas:

- `payment_terms_json` (text, NULL)
- `delivery_days` (int, default 0)
- `offer_validity_days` (int, default 30)
- `commercial_advisor_json` (text, NULL)
- `change_order_seq` (int, default 0)

---

## ✅ Check 4 — `contracts.pricing_mode` (migración 005)

```sql
SHOW COLUMNS FROM contracts;
```

**Esperado:** una columna `pricing_mode` (ENUM `('UNIT_PRICE','LUMP_SUM','COST_PLUS')`, NULL) **después** de `advance_percent`.

---

## ✅ Check 5 — `document_generation_log` (migraciones 006 + 007)

```sql
SHOW CREATE TABLE document_generation_log;
```

**Esperado:** la tabla tiene todas estas columnas:

- Base: `id`, `entity`, `entity_id`, `template_id`, `file_name`, `sharepoint_path`, `web_url`, `status` (ENUM OK/ERROR), `error_code`, `duration_ms`, `user_id`, `created_at`
- Auditoría (007): `ip`, `user_agent`, `attempts`, `template_version`

Y 4 índices: `idx_entity`, `idx_created`, `idx_status`, `idx_template`.

---

## ✅ Check 6 — `generated_document_url` en 6 entidades (migración 006)

```sql
SHOW COLUMNS FROM payment_requests LIKE 'generated_document_url';
SHOW COLUMNS FROM expenses         LIKE 'generated_document_url';
SHOW COLUMNS FROM work_cuts        LIKE 'generated_document_url';
SHOW COLUMNS FROM contracts        LIKE 'generated_document_url';
SHOW COLUMNS FROM employees        LIKE 'generated_document_url';
SHOW COLUMNS FROM work_logs        LIKE 'generated_document_url';
```

**Esperado:** 6 filas `text NULL`, una por cada entidad.

---

## ✅ Check 7 — AIU check (migración 008)

```sql
SHOW CREATE TABLE aiu_configs;
```

**Esperado:** en la última línea del CREATE TABLE:

```sql
CONSTRAINT `chk_aiu_range` CHECK ((`administration` between 0 and 100)
                              and (`imprevistos` between 0 and 100)
                              and (`utilidad` between 0 and 100))
```

Y **NO** debe aparecer `chk_aiu_sum` en ninguna parte.

---

## ✅ Check 8 — Control de Cambios (migración 009)

```sql
SHOW CREATE TABLE budget_change_orders;
SHOW CREATE TABLE budget_change_order_items;
```

**Esperado en `budget_change_orders`:**

- Columna `request_channel` con ENUM `('ACTA_COMITE','MAIL','SOLICITUD_VERBAL','OTROS')`
- Columnas `aiu_administration`, `aiu_imprevistos`, `aiu_utilidad` (DECIMAL 5,2)
- Columna `iva_on_utility_pct` con default 19
- Columna `status` con ENUM `('DRAFT','SUBMITTED','APPROVED','REJECTED')`
- 2 índices: `idx_bco_budget_seq` y `idx_bco_budget_status`

**Esperado en `budget_change_order_items`:**

- Columna `change_order_id` (FK a `budget_change_orders`)
- Columnas `unit_price` y `total_price` (DECIMAL 15,2)
- Índice `idx_bcoi_co`

---

## Si algo falla

| Síntoma                                                       | Archivo de recuperación                                                                                              |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `chk_aiu_range` no aparece, tabla `aiu_configs` rota          | `999_emergency_aiu_recovery.sql` (recreación completa)                                                               |
| Las FKs de `users` no se crearon (permisos insuficientes)     | Aplicar manualmente con `ALTER TABLE ... ADD CONSTRAINT` desde consola (suele ser problema de Hostinger restringido) |
| Error 1215 (Cannot add foreign key) en `budget_change_orders` | Verificar que `budget_versions` y `users` existen con SHOW TABLES                                                    |

---

## Resultado esperado: **8/8 checks en verde** ✅
