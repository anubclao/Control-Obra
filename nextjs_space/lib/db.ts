import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  transactionOptions: {
    maxWait: 15000,
    timeout: 30000,
  },
})

// Always cache the prisma client in globalThis to prevent too many connections
globalForPrisma.prisma = prisma

interface DbRetryOptions {
  retries?: number
  baseDelayMs?: number
}

function isRetryableDbError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return (
    message.includes('too many connections') ||
    message.includes('deadlock') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('econnreset') ||
    message.includes('econnrefused')
  )
}

export async function withDbRetry<T>(
  operation: () => Promise<T>,
  options: DbRetryOptions = {}
): Promise<T> {
  const retries = Math.max(0, options.retries ?? 2)
  const baseDelayMs = Math.max(100, options.baseDelayMs ?? 250)

  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt >= retries || !isRetryableDbError(error)) {
        throw error
      }

      const waitMs = baseDelayMs * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }
  }

  throw lastError
}

export async function ensureDatabaseConnection(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`
}
