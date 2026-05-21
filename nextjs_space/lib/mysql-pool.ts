import mysql, { Pool, PoolOptions } from "mysql2/promise"

const globalForMysql = globalThis as unknown as {
  mysqlPool: Pool | undefined
}

function parseConnectionLimit(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

function getPoolConfigFromEnv(): PoolOptions {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no esta configurada")
  }

  return {
    uri: databaseUrl,
    waitForConnections: true,
    connectionLimit: parseConnectionLimit(process.env.DB_POOL_CONNECTION_LIMIT, 20),
    queueLimit: parseConnectionLimit(process.env.DB_POOL_QUEUE_LIMIT, 0),
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    multipleStatements: true,
  }
}

export function getMysqlPool(): Pool {
  if (!globalForMysql.mysqlPool) {
    globalForMysql.mysqlPool = mysql.createPool(getPoolConfigFromEnv())
  }

  return globalForMysql.mysqlPool
}

export async function queryMysql<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
  const pool = getMysqlPool()
  const [rows] = await pool.query(sql, params)
  return rows as T[]
}

export async function closeMysqlPool(): Promise<void> {
  if (globalForMysql.mysqlPool) {
    await globalForMysql.mysqlPool.end()
    globalForMysql.mysqlPool = undefined
  }
}
