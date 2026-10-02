// filepath: src/lib/sharepoint/retry.ts
// Helper de retry con backoff exponencial + jitter.
// Solo reintenta errores transitorios (timeout, 5xx, errores de red).
// NO reintenta 4xx (auth/forbidden/not-found/conflict) — son errores
// de causa conocida que no se resuelven con reintentos.
//
// F4 §10 Riesgos: "Network timeout (>30s al subir) — Reintentar 1 vez"
// Aquí generalizamos: hasta N intentos con backoff 500ms→1s→2s→4s.

import { GraphError } from "./client";

export interface RetryOptions {
  /** Máximo de intentos (incluyendo el primero). Default 3. */
  maxAttempts?: number;
  /** Backoff base en ms. Default 500. */
  baseDelayMs?: number;
  /** Multiplicador exponencial. Default 2. */
  factor?: number;
  /** Jitter máximo en ms (sumado al backoff). Default 250. */
  jitterMs?: number;
  /** Hook opcional para logging/testing. */
  onRetry?: (info: { attempt: number; delayMs: number; error: Error }) => void;
}

export interface RetryResult<T> {
  value: T;
  attempts: number;
}

/**
 * Errores que NUNCA se reintentan (no se resuelven solos).
 */
const NON_RETRYABLE = new Set<string>([
  "SP_AUTH_FAILED",
  "SP_FORBIDDEN",
  "SP_NOT_FOUND",
  "SP_SITE_NOT_FOUND",
  "SP_CONFLICT",
]);

/**
 * Decide si un error es transitorio (vale la pena reintentar).
 *  - Timeouts, 5xx, errores de red (status=0): sí.
 *  - 4xx lógicos: no.
 */
export function isRetryableError(err: unknown): boolean {
  if (err instanceof GraphError) {
    if (NON_RETRYABLE.has(err.code)) return false;
    // 5xx y SP_TIMEOUT (status 0 o 408) → reintentar
    if (err.status === 0 || err.status >= 500 || err.code === "SP_TIMEOUT") {
      return true;
    }
    return false;
  }
  // Errores de red genéricos (fetch failed, ECONNRESET, etc.)
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("econnrefused") ||
      msg.includes("fetch failed") ||
      msg.includes("network")
    ) {
      return true;
    }
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function computeDelay(
  attempt: number,
  baseDelayMs: number,
  factor: number,
  jitterMs: number,
): number {
  const exp = baseDelayMs * Math.pow(factor, attempt - 1);
  const jitter = Math.random() * jitterMs;
  return Math.round(exp + jitter);
}

/**
 * Ejecuta `fn` con reintentos automáticos. Si `fn` lanza un error
 * retryable, espera `baseDelayMs * factor^(attempt-1) + jitter` y
 * reintenta. Si no es retryable, propaga inmediatamente.
 *
 * Lanza el ÚLTIMO error si se agotan los intentos.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions = {},
): Promise<RetryResult<T>> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
  const baseDelayMs = Math.max(50, opts.baseDelayMs ?? 500);
  const factor = Math.max(1, opts.factor ?? 2);
  const jitterMs = Math.max(0, opts.jitterMs ?? 250);

  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const value = await fn(attempt);
      return { value, attempts: attempt };
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      lastError = err;
      if (!isRetryableError(e)) {
        throw err;
      }
      if (attempt >= maxAttempts) {
        // Se agotaron los intentos; lanzar el último error.
        break;
      }
      const delayMs = computeDelay(attempt, baseDelayMs, factor, jitterMs);
      opts.onRetry?.({ attempt, delayMs, error: err });
      await sleep(delayMs);
    }
  }
  throw lastError ?? new Error("withRetry: unexpected fallthrough");
}
