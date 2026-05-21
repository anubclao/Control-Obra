/* eslint-disable no-console */
const fs = require("fs")
const path = require("path")
const mysql = require("mysql2/promise")
require("dotenv").config()

const SQL_FILES = [
  path.resolve(__dirname, "../migrations/add_access_control_roles.sql"),
  path.resolve(__dirname, "../migrations/add_access_control_db_objects.sql"),
  path.resolve(__dirname, "../../database/mysql/functions.sql"),
  path.resolve(__dirname, "../../database/mysql/triggers.sql"),
  path.resolve(__dirname, "../../database/mysql/procedures.sql"),
  path.resolve(__dirname, "../../database/mysql/views.sql"),
]

function getConnectionLimit() {
  const parsed = Number(process.env.DB_POOL_CONNECTION_LIMIT || 20)
  if (!Number.isFinite(parsed) || parsed <= 0) return 20
  return Math.floor(parsed)
}

function parseSqlStatements(content) {
  const lines = content.split(/\r?\n/)
  const statements = []

  let delimiter = ";"
  let buffer = ""

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith("--")) {
      continue
    }

    if (/^DELIMITER\s+/i.test(trimmed)) {
      delimiter = trimmed.split(/\s+/)[1] || ";"
      continue
    }

    buffer += `${line}\n`

    const candidate = buffer.trimEnd()
    if (!candidate) continue

    if (candidate.endsWith(delimiter)) {
      const statement = candidate.slice(0, -delimiter.length).trim()
      buffer = ""

      if (!statement) continue
      if (/^USE\s+/i.test(statement)) continue
      statements.push(statement)
    }
  }

  const remainder = buffer.trim()
  if (remainder) statements.push(remainder)

  return statements
}

async function executeWithRetry(connection, statement, retries = 2) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await connection.query(statement)
      return
    } catch (error) {
      lastError = error
      const message = String(error?.message || "").toLowerCase()
      const retryable =
        message.includes("deadlock") ||
        message.includes("timeout") ||
        message.includes("connection") ||
        message.includes("too many connections")

      if (!retryable || attempt >= retries) {
        throw error
      }

      const backoff = 200 * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, backoff))
    }
  }

  throw lastError
}

async function applySqlFile(connection, filePath) {
  const source = fs.readFileSync(filePath, "utf8")
  const statements = parseSqlStatements(source)

  console.log(`\n[DB DEPLOY] Ejecutando ${path.basename(filePath)} (${statements.length} sentencias)`)

  for (const statement of statements) {
    try {
      await executeWithRetry(connection, statement)
    } catch (error) {
      const message = String(error?.message || "")
      const isPrivilegedRestriction =
        message.includes("SUPER privilege") ||
        message.includes("log_bin_trust_function_creators")
      const isMissingDependencyForView =
        message.includes("does not exist") && /^CREATE\s+OR\s+REPLACE\s+VIEW|^CREATE\s+VIEW/i.test(statement.trim())

      if (isPrivilegedRestriction) {
        console.warn("[DB DEPLOY] WARN objeto privilegiado omitido por permisos:", statement.split("\n")[0])
        continue
      }

      if (isMissingDependencyForView) {
        console.warn("[DB DEPLOY] WARN vista omitida por dependencia faltante:", statement.split("\n")[0])
        continue
      }

      throw error
    }
  }

  console.log(`[DB DEPLOY] OK ${path.basename(filePath)}`)
}

async function run() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no configurada")
  }

  const pool = mysql.createPool({
    uri: databaseUrl,
    waitForConnections: true,
    connectionLimit: getConnectionLimit(),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    multipleStatements: false,
  })

  const connection = await pool.getConnection()

  try {
    for (const filePath of SQL_FILES) {
      if (!fs.existsSync(filePath)) {
        throw new Error(`No existe el archivo SQL: ${filePath}`)
      }
      await applySqlFile(connection, filePath)
    }

    console.log("\n[DB DEPLOY] Despliegue SQL completado")
  } finally {
    connection.release()
    await pool.end()
  }
}

run().catch((error) => {
  console.error("\n[DB DEPLOY] ERROR:", error.message)
  process.exit(1)
})
