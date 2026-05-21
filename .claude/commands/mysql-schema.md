# Skill: MySQL Schema

Gestiona el esquema MySQL del proyecto ControlObra. Trabaja con los archivos en `database/mysql/`.

## Archivos del esquema

| Archivo | Contenido |
|---------|-----------|
| `database/mysql/views.sql` | Vistas analíticas y de reporte |
| `database/mysql/functions.sql` | Funciones escalares reutilizables |
| `database/mysql/triggers.sql` | Triggers de cálculo y auditoría |
| `database/mysql/procedures.sql` | Procedimientos almacenados de negocio |
| `database/mysql/seed.sql` | Datos iniciales de configuración |

## Cómo usar

### Agregar una vista

Lee el schema Prisma para entender las tablas, luego crea la vista en `views.sql`:

```sql
CREATE OR REPLACE VIEW v_nombre AS
SELECT 
    t.id,
    t.campo,
    -- ... joins y cálculos
FROM Tabla t
LEFT JOIN OtraTabla o ON o.tablaId = t.id;
```

Convenciones:
- Nombre: `v_<entidad>_<proposito>` (ej: `v_project_summary`, `v_payment_dashboard`)
- Siempre incluir `id` de la entidad principal
- Campos calculados con alias descriptivos en inglés
- `COALESCE(suma, 0)` para evitar NULLs en agregaciones

### Agregar un trigger

```sql
DELIMITER $$
CREATE TRIGGER tr_<tabla>_<momento>_<evento>
AFTER INSERT ON <Tabla>
FOR EACH ROW
BEGIN
    -- lógica
END$$
DELIMITER ;
```

Momentos: `before` o `after`. Eventos: `insert`, `update`, `delete`.
Nombre: `tr_<tabla>_<after|before>_<insert|update|delete>`

### Agregar un procedimiento

```sql
DELIMITER $$
CREATE PROCEDURE sp_nombre(
    IN p_param1 VARCHAR(25),
    OUT p_resultado VARCHAR(50)
)
BEGIN
    DECLARE v_variable INT DEFAULT 0;
    -- lógica
END$$
DELIMITER ;
```

Convenciones:
- Parámetros de entrada: prefijo `p_`
- Variables locales: prefijo `v_`
- Siempre manejar errores con `DECLARE EXIT HANDLER FOR SQLEXCEPTION`

### Agregar una función

```sql
DELIMITER $$
CREATE FUNCTION fn_nombre(p_param DECIMAL(20,2))
RETURNS VARCHAR(50)
DETERMINISTIC
BEGIN
    DECLARE v_result VARCHAR(50);
    -- lógica
    RETURN v_result;
END$$
DELIMITER ;
```

## Funciones existentes (no recrear)

- `fn_format_cop(amount)` — Formatea como pesos colombianos
- `fn_days_until(date)` — Días hasta una fecha
- `fn_calc_aiu(directCost, adminPct, imprevistosPct, utilidadPct, ivaPct)` — Calcula AIU total
- `fn_payment_status_label(status)` — Etiqueta en español para estado de pago
- `fn_doc_expired(expirationDate)` — 1 si vencido, 0 si vigente

## Vistas existentes (no recrear)

- `v_project_summary` — Proyectos con totales de presupuesto y pagos
- `v_budget_progress` — Ítems de presupuesto con avance acumulado
- `v_payment_dashboard` — Pagos con nivel de aprobación actual
- `v_contractor_doc_status` — Subcontratistas con % de documentación
- `v_work_cut_summary` — Cortes con estado de pago
- `v_employee_doc_expiry` — Empleados con documentos próximos a vencer
- `v_financial_summary` — Resumen financiero por proyecto
- `v_quotation_pipeline` — Pipeline de ventas por estado

## Procedimientos existentes (no recrear)

- `sp_recalculate_budget(budgetId)` — Recalcula totales del presupuesto en cascada
- `sp_approve_payment(paymentId, approverId, level, comments)` — Flujo de aprobación
- `sp_reject_payment(paymentId, approverId, comments)` — Rechazo con razón
- `sp_get_financial_report(projectId, startDate, endDate)` — Reporte financiero

## Ejemplo de uso

```
/mysql-schema tipo="vista" nombre="v_employee_cost_summary" descripcion="Costo total de empleados por departamento y proyecto"
```
