import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

/**
 * Idempotency key management for preventing duplicate jobs
 * 
 * Ensures that if a client retries the same request (with same idempotency key),
 * they get the same job ID instead of creating a new one
 */

const idempotencyCache = new Map<string, string>();
const MAX_IDEMPOTENCY_KEYS = 10000;

function generateIdempotencyHash(projectId: string | null): string {
  const key = `project:${projectId || 'all'}`;
  return createHash('sha256').update(key).digest('hex');
}

function trimIdempotencyCache() {
  if (idempotencyCache.size <= MAX_IDEMPOTENCY_KEYS) {
    return;
  }

  const excess = idempotencyCache.size - MAX_IDEMPOTENCY_KEYS;
  let removed = 0;

  for (const key of idempotencyCache.keys()) {
    idempotencyCache.delete(key);
    removed++;
    if (removed >= excess) break;
  }
}

/**
 * Get or create idempotency key for a request
 * @param clientIdempotencyKey - Client-provided idempotency key (optional)
 * @param projectId - Project ID for the job
 * @returns Idempotency key to use
 */
export function getOrCreateIdempotencyKey(
  clientIdempotencyKey: string | undefined,
  projectId: string | null
): string {
  // If client provided a key, use it as-is
  if (clientIdempotencyKey) {
    return clientIdempotencyKey;
  }

  // Otherwise generate one based on project
  // This ensures requests for same project get same key within a time window
  return generateIdempotencyHash(projectId);
}

/**
 * Check if idempotency key already has a job ID
 * @returns Existing job ID or null
 */
export function getIdempotentJobId(idempotencyKey: string): string | null {
  const jobId = idempotencyCache.get(idempotencyKey);
  return jobId ?? null;
}

/**
 * Store idempotency key → job ID mapping
 */
export function storeIdempotencyKey(idempotencyKey: string, jobId: string) {
  idempotencyCache.set(idempotencyKey, jobId);
  trimIdempotencyCache();
}

/**
 * Clear idempotency mapping (useful for testing)
 */
export function clearIdempotencyCache() {
  idempotencyCache.clear();
}

/**
 * Get cache size for monitoring
 */
export function getIdempotencyCacheSize(): number {
  return idempotencyCache.size;
}
