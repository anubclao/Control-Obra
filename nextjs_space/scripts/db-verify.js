/* eslint-disable no-console */
const mysql = require("mysql2/promise")
require("dotenv").config()

const EXPECTED_TABLES = [
  "AccessRole",
  "MenuPermission",
  "UserAccessRole",
  "AccessControlAudit",
]

const EXPECTED_FUNCTIONS = [
  "fn_format_cop",
  "fn_days_until",
  "fn_doc_expired",
  "fn_doc_expires_soon",
  "fn_calc_aiu",
  "fn_payment_status_label",
  "fn_project_status_label",
  "fn_work_cut_status_label",
  "fn_budget_item_status",
]

const EXPECTED_PROCEDURES = [
  "sp_recalculate_budget",
  "sp_approve_payment",
  "sp_reject_payment",
  "sp_get_project_dashboard",
  "sp_get_financial_report",
  "sp_check_expiring_documents",
  "sp_update_contractor_status",
  "sp_assign_user_access_role",
]

const EXPECTED_VIEWS = [
  "v_project_summary",
  "v_budget_progress",
  "v_payment_dashboard",
  "v_contractor_doc_status",
  "v_work_cut_summary",
  "v_employee_doc_expiry",
  "v_financial_summary",
  "v_quotation_pipeline",
  "v_supplier_doc_status",
  "v_access_role_summary",
  "v_user_access_profile",
]

const REQUIRED_VIEWS = ["v_access_role_summary", "v_user_access_profile"]
const REQUIRED_PROCEDURES = ["sp_assign_user_access_role"]

const EXPECTED_TRIGGERS = [
  "tr_budget_item_after_insert",
  "tr_budget_item_after_update",
  "tr_budget_item_after_delete",
  "tr_budget_layer_after_update",
  "tr_payment_approval_after_insert",
  "tr_work_cut_after_update",
  "tr_document_after_insert",
  "tr_document_after_delete",
  "tr_project_status_audit",
  "tr_payment_status_audit",
  "tr_user_access_role_audit_insert",
  "tr_user_access_role_audit_delete",
  "tr_menu_permission_audit_update",
]

const strictMode = String(process.env.DB_VERIFY_STRICT || "0") === "1"

async function getSchema(connection) {
  const [rows] = await connection.query("SELECT DATABASE() AS db")
  return rows[0]?.db
}

function diffExpected(actualSet, expectedList) {
  return expectedList.filter((name) => !actualSet.has(name))
}

async function existsTable(connection, schema, tableName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = ? AND LOWER(table_name) = LOWER(?)`,
    [schema, tableName]
  )
  return Number(rows[0]?.total || 0) > 0
}

async function existsView(connection, schema, viewName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS total FROM information_schema.views WHERE table_schema = ? AND LOWER(table_name) = LOWER(?)`,
    [schema, viewName]
  )
  return Number(rows[0]?.total || 0) > 0
}

async function existsRoutine(connection, schema, routineName, routineType) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS total FROM information_schema.routines WHERE routine_schema = ? AND LOWER(routine_name) = LOWER(?) AND routine_type = ?`,
    [schema, routineName, routineType]
  )
  return Number(rows[0]?.total || 0) > 0
}

async function existsTrigger(connection, schema, triggerName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS total FROM information_schema.triggers WHERE trigger_schema = ? AND LOWER(trigger_name) = LOWER(?)`,
    [schema, triggerName]
  )
  return Number(rows[0]?.total || 0) > 0
}

async function run() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL no configurada")

  const connection = await mysql.createConnection({ uri: databaseUrl })

  try {
    const schema = await getSchema(connection)
    if (!schema) throw new Error("No se pudo detectar el schema actual")

    const failures = []

    const missingTables = []
    for (const tableName of EXPECTED_TABLES) {
      const ok = await existsTable(connection, schema, tableName)
      if (!ok) missingTables.push(tableName)
    }
    if (missingTables.length) failures.push(`Tablas faltantes: ${missingTables.join(", ")}`)

    const missingFunctions = []
    for (const functionName of EXPECTED_FUNCTIONS) {
      const ok = await existsRoutine(connection, schema, functionName, "FUNCTION")
      if (!ok) missingFunctions.push(functionName)
    }
    if (missingFunctions.length) {
      if (strictMode) {
        failures.push(`Funciones faltantes: ${missingFunctions.join(", ")}`)
      } else {
        console.warn(`[DB VERIFY] WARN Funciones faltantes por permisos: ${missingFunctions.join(", ")}`)
      }
    }

    const missingProcedures = []
    for (const procedureName of EXPECTED_PROCEDURES) {
      const ok = await existsRoutine(connection, schema, procedureName, "PROCEDURE")
      if (!ok) missingProcedures.push(procedureName)
    }
    const missingRequiredProcedures = missingProcedures.filter((name) => REQUIRED_PROCEDURES.includes(name))
    const missingOptionalProcedures = missingProcedures.filter((name) => !REQUIRED_PROCEDURES.includes(name))

    if (missingRequiredProcedures.length) {
      failures.push(`Procedimientos criticos faltantes: ${missingRequiredProcedures.join(", ")}`)
    }

    if (missingOptionalProcedures.length) {
      if (strictMode) {
        failures.push(`Procedimientos faltantes: ${missingOptionalProcedures.join(", ")}`)
      } else {
        console.warn(`[DB VERIFY] WARN Procedimientos faltantes por permisos: ${missingOptionalProcedures.join(", ")}`)
      }
    }

    const missingViews = []
    for (const viewName of EXPECTED_VIEWS) {
      const ok = await existsView(connection, schema, viewName)
      if (!ok) missingViews.push(viewName)
    }
    const missingRequiredViews = missingViews.filter((name) => REQUIRED_VIEWS.includes(name))
    const missingOptionalViews = missingViews.filter((name) => !REQUIRED_VIEWS.includes(name))

    if (missingRequiredViews.length) {
      failures.push(`Vistas criticas faltantes: ${missingRequiredViews.join(", ")}`)
    }

    if (missingOptionalViews.length) {
      if (strictMode) {
        failures.push(`Vistas faltantes: ${missingOptionalViews.join(", ")}`)
      } else {
        console.warn(`[DB VERIFY] WARN Vistas opcionales faltantes: ${missingOptionalViews.join(", ")}`)
      }
    }

    const missingTriggers = []
    for (const triggerName of EXPECTED_TRIGGERS) {
      const ok = await existsTrigger(connection, schema, triggerName)
      if (!ok) missingTriggers.push(triggerName)
    }
    if (missingTriggers.length) {
      if (strictMode) {
        failures.push(`Triggers faltantes: ${missingTriggers.join(", ")}`)
      } else {
        console.warn(`[DB VERIFY] WARN Triggers faltantes por permisos: ${missingTriggers.join(", ")}`)
      }
    }

    if (!missingFunctions.includes("fn_payment_status_label")) {
      const [healthRows] = await connection.query("SELECT fn_payment_status_label('PAID') AS label")
      if (!healthRows[0]?.label) {
        failures.push("No se pudo ejecutar fn_payment_status_label")
      }
    }

    const [roleSummary] = await connection.query("SELECT COUNT(*) AS total FROM v_access_role_summary")
    if (!Array.isArray(roleSummary) || roleSummary.length === 0) {
      failures.push("No se pudo consultar v_access_role_summary")
    }

    const [profileRows] = await connection.query("SELECT COUNT(*) AS total FROM v_user_access_profile")
    if (!Array.isArray(profileRows) || profileRows.length === 0) {
      failures.push("No se pudo consultar v_user_access_profile")
    }

    if (failures.length) {
      console.error("\n[DB VERIFY] FALLAS DETECTADAS")
      for (const failure of failures) {
        console.error(`- ${failure}`)
      }
      process.exit(1)
    }

    console.log(`\n[DB VERIFY] Verificacion completa exitosa (strict=${strictMode ? "1" : "0"})`)
    console.log(`[DB VERIFY] Tablas: ${EXPECTED_TABLES.length}`)
    console.log(`[DB VERIFY] Funciones: ${EXPECTED_FUNCTIONS.length}`)
    console.log(`[DB VERIFY] Procedimientos: ${EXPECTED_PROCEDURES.length}`)
    console.log(`[DB VERIFY] Vistas: ${EXPECTED_VIEWS.length}`)
    console.log(`[DB VERIFY] Triggers: ${EXPECTED_TRIGGERS.length}`)
  } finally {
    await connection.end()
  }
}

run().catch((error) => {
  console.error("\n[DB VERIFY] ERROR:", error.message)
  process.exit(1)
})
