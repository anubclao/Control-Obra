# Control de Obra — Capa MySQL

Archivos SQL que complementan el schema de Prisma con lógica de base de datos MySQL.

## Orden de ejecución

```
1. npx prisma migrate dev    (crea las tablas)
2. functions.sql             (funciones escalares)
3. triggers.sql              (triggers de consistencia)
4. procedures.sql            (procedimientos de negocio)
5. views.sql                 (vistas analíticas — dependen de funciones)
6. seed.sql                  (datos iniciales opcionales)
```

## Archivos

| Archivo | Propósito |
|---------|-----------|
| `functions.sql` | Funciones escalares reutilizables |
| `triggers.sql` | Triggers automáticos de consistencia |
| `procedures.sql` | Lógica de negocio en stored procedures |
| `views.sql` | Vistas de reporte y dashboard |

## Funciones disponibles

| Función | Descripción |
|---------|-------------|
| `fn_format_cop(amount)` | Formatea como `$ 1.500.000` |
| `fn_days_until(date)` | Días hasta la fecha (negativo si pasó) |
| `fn_doc_expired(date)` | 1 si el documento está vencido |
| `fn_doc_expires_soon(date, days)` | 1 si vence en N días |
| `fn_calc_aiu(cost, a%, i%, u%, iva%)` | Calcula monto total de AIU |
| `fn_payment_status_label(status)` | Etiqueta en español del estado |
| `fn_project_status_label(status)` | Etiqueta en español del proyecto |
| `fn_budget_item_status(pc, pt)` | GREEN/YELLOW/RED de rentabilidad |

## Vistas disponibles

| Vista | Descripción |
|-------|-------------|
| `v_project_summary` | Proyectos con totales de presupuesto, pagos y avance |
| `v_budget_progress` | Ítems de presupuesto con avance acumulado |
| `v_payment_dashboard` | Pagos con aprobadores e información completa |
| `v_contractor_doc_status` | Subcontratistas con % de documentación |
| `v_work_cut_summary` | Cortes con estado de pago |
| `v_employee_doc_expiry` | Empleados con documentos próximos a vencer |
| `v_financial_summary` | Resumen financiero completo por proyecto |
| `v_quotation_pipeline` | Pipeline de ventas por estado |
| `v_supplier_doc_status` | Proveedores con documentación |

## Triggers automáticos

| Trigger | Tabla | Acción |
|---------|-------|--------|
| `tr_budget_item_after_insert/update/delete` | BudgetItem | Actualiza totales de BudgetLayer |
| `tr_budget_layer_after_update` | BudgetLayer | Recalcula totales de Budget con AIU |
| `tr_payment_approval_after_insert` | PaymentApproval | Actualiza status de PaymentRequest |
| `tr_work_cut_after_update` | WorkCut | Actualiza status del subcontratista |
| `tr_document_after_insert/delete` | Document | Actualiza status del subcontratista |
| `tr_project_status_audit` | Project | Log de cambios de estado |
| `tr_payment_status_audit` | PaymentRequest | Log de cambios de estado |

## Procedimientos almacenados

| Procedimiento | Descripción |
|---------------|-------------|
| `sp_recalculate_budget(budgetId)` | Recalcula todo el presupuesto en cascada |
| `sp_approve_payment(paymentId, approverId, level, comments, OUT newStatus)` | Aprueba pago |
| `sp_reject_payment(paymentId, approverId, level, comments)` | Rechaza pago |
| `sp_get_project_dashboard(projectId)` | Todos los datos del dashboard |
| `sp_get_financial_report(projectId, startDate, endDate)` | Reporte financiero |
| `sp_check_expiring_documents(daysWarning)` | Alertas de documentos |
| `sp_update_contractor_status(contractorId)` | Recalcula status del subcontratista |

## Uso desde Next.js (Prisma)

```typescript
// Usar una vista
const projects = await prisma.$queryRaw`
  SELECT * FROM v_project_summary WHERE status = 'IN_EXECUTION'
`;

// Llamar un procedimiento
await prisma.$executeRaw`
  CALL sp_recalculate_budget(${budgetId})
`;

// Llamar una función en una query
const formatted = await prisma.$queryRaw`
  SELECT fn_format_cop(${amount}) AS formatted
`;
```

## Tabla de auditoría

`AuditLog` se crea en `triggers.sql` (no en Prisma). Guarda cambios de estado de proyectos y pagos. Útil para reportes de trazabilidad.

## Gestión con el skill `/mysql-schema`

Usa el skill `/mysql-schema` para agregar nuevas vistas, funciones, triggers o procedimientos con las convenciones correctas del proyecto.
